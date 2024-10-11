type CallbackItem = {
  /** the actual callback */
  cb: Function;
  /** for once listeners */
  weak?: boolean;
  /** to mark that the callback has been fired for at least one time */
  fired?: boolean;
};

/**
 * A custom event that can save an extra data parameter
 */
class CustomEvent extends Event {
  data: any[] | undefined = undefined;
  constructor(type: string, data: any[] | undefined) {
    super(type, { bubbles: false, cancelable: false });
    this.data = data;
  }
}

/**
 * A simple independent event dispatcher.
 *
 * The unique feature here is type hint if type annotation is provided, so that we don't need to guess or read the doc or read the code for the event list, for example:
 *
 * ```
 * // create emiter with type annotation
 * const emiter = new EventEmitter<{'updated': () => any; 'loaded': (item: Item) => any}>();
 *
 * // later we can get type hint from the emiter for the parameters of all it's functions
 * emiter.on('updated', () => {});
 * emiter.once('loaded', (item) => {console.log(item)});
 *
 * // or the type annotation could be extracted for better readbility and maintanability
 * type EventMap = {
 *  'updated': () => any;
 *  'loade': (item: Item) => any;
 * }
 * const emiter = new EventEmitter<EventMap>();
 * ```
 */
export class EventEmitter<
  EventMap extends Record<string, Function> | void,
  EventType = EventMap extends Record<string, Function> ? keyof EventMap : string,
  EventHandler = EventMap extends Record<string, Function> ? EventMap[keyof EventMap] : Function
> {
  private storedCallbacks = new Map<string, Array<CallbackItem>>();
  private dispatcher!: HTMLDivElement;

  constructor(eventDelegate?: HTMLDivElement) {
    this.dispatcher = eventDelegate || document.createElement('div');
  }

  /**
   * Dispatch an event
   *
   * @param rest optional parameters for the event
   */
  dispatch = (type: EventType, ...rest: any[]) => {
    this.dispatcher.dispatchEvent(new CustomEvent(type as string, rest));
  };

  /**
   * Listen to an event
   *
   * @returns a cancel function used to remove the listener
   */
  on = (type: EventType, cb: EventHandler) => {
    let callbacks: Array<CallbackItem> = [];
    if (this.storedCallbacks.has(type as string)) callbacks = this.storedCallbacks.get(type as string) || [];
    if (!callbacks.find((item) => item.cb === cb)) callbacks.push({ cb: cb as Function });

    if (!this.storedCallbacks.has(type as string)) {
      this.storedCallbacks.set(type as string, callbacks);
      this.dispatcher.addEventListener(type as string, this.handler);
    }

    return () => this.off(type, cb);
  };

  /**
   * Listen for once and then the callback will be auto removed
   *
   * @param type event type derived from generics
   * @param cb event handler function
   */
  once = (type: EventType, cb: EventHandler) => {
    let callbacks: Array<CallbackItem> = [];
    if (this.storedCallbacks.has(type as string)) callbacks = this.storedCallbacks.get(type as string) || [];
    if (!callbacks.find((item) => item.cb === cb)) callbacks.push({ cb: cb as Function, weak: true });

    if (!this.storedCallbacks.has(type as string)) {
      this.storedCallbacks.set(type as string, callbacks);
      this.dispatcher.addEventListener(type as string, this.handler);
    }
  };

  /**
   * Remove an event listener
   */
  off = (type: EventType, cb: EventHandler) => {
    const callbacks = this.storedCallbacks.get(type as string);
    const index = callbacks ? callbacks.findIndex((item) => item.cb === cb) : -1;
    if (index !== -1) callbacks?.splice(index, 1);
    if (!callbacks || callbacks.length == 0) {
      this.storedCallbacks.delete(type as string);
      this.dispatcher.removeEventListener(type as string, this.handler);
    }
  };

  /**
   * Remove all the listeners for a specific event
   */
  offAll = (type: EventType) => {
    const callbacks = this.storedCallbacks.get(type as string);
    if (callbacks) callbacks.length = 0;

    this.storedCallbacks.delete(type as string);
    this.dispatcher.removeEventListener(type as string, this.handler);
  };

  /**
   * Clear all the event listeners in the emitter
   */
  clear = () => {
    this.storedCallbacks.forEach((_, type) => {
      this.offAll(type as EventType);
    });
    this.storedCallbacks.clear();
  };

  private handler = (e: Event) => {
    const event = e as CustomEvent;
    const { type, data } = event;
    const listeners = this.storedCallbacks.get(type);
    if (!listeners || listeners.length === 0) return;

    listeners.forEach((c) => {
      c.cb.apply(undefined, data ? data : []);
      if (c.weak && !c.fired) c.fired = true;
    });

    const left = listeners.filter((c) => !!c.cb && (!c.weak || (c.weak && !c.fired)));
    if (left.length === 0) this.storedCallbacks.delete(type);
    else if (left) this.storedCallbacks.set(type, left);
  };
}
