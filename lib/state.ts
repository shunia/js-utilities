import { nextTime } from './next-time';

type SubscriberMeta<T, P extends keyof T> = {
  subscriber: (state: T) => any;
  keys?: P[];
};
export type Subscriber<T> = (state: T) => any;

const noop = () => {};

class StateSubscriber<T, P extends keyof T = keyof T> {
  protected _subscribers: SubscriberMeta<T, P>[] = [];
  protected _removedSubscribers: SubscriberMeta<T, P>[] = [];

  subscribe(subscriber: Subscriber<T>, keys?: P[]) {
    if (this._subscribers.findIndex((ret) => ret.subscriber == subscriber) == -1)
      if (keys && keys.length) this._subscribers.push({ subscriber, keys });
      else this._subscribers.push({ subscriber });
    return () => {
      const found = this._subscribers.find((ret) => ret.subscriber == subscriber);
      if (found) this._removedSubscribers.push(found);
    };
  }

  createSubscribeWrapper(timeout = 200) {
    return (subscriber: Subscriber<T>, error?: (e: any) => any) => {
      let unsub: Function,
        id: any = -1;
      const wrapper = (state: T) => {
        clearTimeout(id);
        if (subscriber) subscriber(state);
        if (unsub) unsub();
      };
      unsub = this.subscribe(wrapper);
      if (error) {
        id = setTimeout(() => {
          clearTimeout(id);
          if (error) error('state not update');
        }, timeout);
      }
    };
  }

  notify(state: T, prevState: T) {
    let subscribers: SubscriberMeta<T, P>[];
    if (!this._removedSubscribers || this._removedSubscribers.length == 0) subscribers = this._subscribers;
    else {
      subscribers = [];
      for (let i = 0; i < this._subscribers.length; i++) {
        const sub = this._subscribers[i];
        if (!this._removedSubscribers || this._removedSubscribers.indexOf(sub) == -1) subscribers.push(sub);
      }
      // 把剩下的回调替换到原数组里
      this._subscribers.splice(0, this._subscribers.length, ...subscribers);
      // 清空已经移除的回调
      this._removedSubscribers = [];
    }
    subscribers &&
      subscribers.forEach((ret) => {
        // 不需要按 key 更新，直接回调
        if (!ret.keys) ret.subscriber && ret.subscriber(state);
        // 如果需要按 key 更新，检测数据上的 key 是否变化
        else if (this.isStateChangedWithKeys(prevState, state, ret.keys)) ret.subscriber && ret.subscriber(state);
      });
  }

  /**
   * 判断两个对象之间，指定的 key 对应的值是否有变化。
   * @param prevState 前一个数据对象
   * @param newState 当前数据对象
   * @param keys 需要检查的字段（只能支持一层）
   */
  private isStateChangedWithKeys(prevState: T, newState: T, keys: P[]) {
    if (prevState === newState) return false;
    if (!keys || !keys.length) return false;

    let changed = false;
    for (let i = 0; i < keys.length; i++) {
      const prevValue = prevState[keys[i]],
        newValue = newState[keys[i]];
      if (prevValue != newValue) {
        changed = true;
        // console.debug(
        //   "[State] keys triggered:",
        //   "\nprev:",
        //   prevState,
        //   "\nnew:",
        //   newState,
        //   "\nkey:",
        //   keys[i]
        // );
        break;
      }
    }
    return changed;
  }

  dispose() {
    this._subscribers = [];
    this._removedSubscribers = [];
  }
}

/**
 * A simple asynchronous state manager.
 *
 * It's uniquness is at partial subscription of state changes and ability to be used in asynchronous environments.
 *
 * How to use:
 *```
 * const state = State.createState({ count: 0, foo: 'bar' });
 * state.subscribe((newState) => console.log('state changed:', newState.count));
 * state.subscribe((value) => console.log('count changed:', value), ['count']);
 *
 * state.setState({ count: 1 });
 * // log will be:
 * // state changed: 1
 * // count changed: 1
 *
 * state.setState({ foo: 'foobar' });
 * // log will be:
 * // state changed: 1
 * ```
 */
export class State<T> {
  /**
   * Creates a new state instance with the given initial state and immediate flush option.
   *
   * @param initialState the initial value of the state
   * @param immediateFlush whether to flush state immediately when setState is called, of set to false, the state will be delayed until the next tick
   * @returns a state instance that could be used to update state and listen to state changes
   */
  public static createState<T>(initialState: Partial<T>, immediateFlush: boolean = false): State<T> {
    return new State(initialState, immediateFlush);
  }

  private static _id: number = -1;
  private static incrementId() {
    return this._id++;
  }

  private _state: T;
  private _stateChanges: Partial<T>[] = [];
  private _dirty: boolean = false;
  private _subscriber: StateSubscriber<T>;
  private _internalId: number = -1;
  private _immediateFlush: boolean = false;

  constructor(initialState: Partial<T>, immediateFlush: boolean = false) {
    this._internalId = State.incrementId();
    this._state = initialState as T;
    this._subscriber = new StateSubscriber();
    this._immediateFlush = immediateFlush;
    this.markDirty();
  }

  get id() {
    return this._internalId;
  }

  /**
   * Add subscriber to the state to listen to state changes, the optional keys parameter allows to listen to specific keys for their updates.
   *
   * @param subscriber callback function that will be called when state changes
   * @param keys optional keys, if provided, only changes of these keys will trigger the subscriber
   */
  subscribe<P extends keyof T>(subscriber: Subscriber<T>, keys?: P[]) {
    return this._subscriber.subscribe(subscriber, keys);
  }

  /**
   * Updates the state with the provided partial state.
   *
   * This method can be used in two ways:
   * 1. As a promise, which resolves with the new state after it has been updated.
   * 2. As a function that takes a subscriber callback, which will be called when the state is updated.
   *
   * @param state - The partial state to update.
   * @returns - If called as a promise, it resolves with the new state after it has been updated.
   *          - If called with a subscriber callback, it returns a function that can be used to unsubscribe from the updates.
   */
  setState(state: Partial<T>): Promise<T>;
  setState(state: Partial<T>, subscriber: Subscriber<T>): () => void;
  setState(state: Partial<T>, subscriber: Subscriber<T>): () => void;
  setState(state: Partial<T>, subscriber?: Subscriber<T>): any {
    // save all the changes
    if (!this._stateChanges) this._stateChanges = [];
    this._stateChanges.push(state);
    this.markDirty();

    // resolve subscribers
    if (subscriber) {
      // if provided, subscribe them
      return this._subscriber.subscribe(subscriber);
    } else {
      // if not provided,
      return new Promise<T>(this._subscriber.createSubscribeWrapper()).catch(noop);
    }
  }

  getState() {
    return this._state;
  }

  markDirty() {
    if (this._dirty) return;
    this._dirty = true;

    if (this._immediateFlush) this.tick();
    else nextTime(() => this.tick());
  }

  dispose() {
    this._stateChanges = [];
    this._state = {} as T;
    this._subscriber?.dispose();
  }

  private tick() {
    this._dirty = false;

    let newState: T;
    // merge all the saved changes between ticks
    if (this._stateChanges && this._stateChanges.length) {
      const flushableStates = this._stateChanges.splice(0, this._stateChanges.length);
      // console.debug("[State]", "flushing states", flushableStates);
      flushableStates.unshift({}, this._state);
      // generate new state
      newState = Object.assign({}, ...flushableStates);
    } else {
      newState = Object.assign({}, this._state);
    }
    // flush the new state and notify all the listeners
    this.flush(newState);
  }

  private flush(state: T) {
    const prevState = this._state;
    this._state = state;
    this._subscriber.notify(this._state, prevState);
  }
}
