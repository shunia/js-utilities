import { nextTime } from './next-time';

type QueueOptions = {
  /**  whether to ensure uniqueness of items in the queue */
  unique?: boolean;
};

type SchedulerOnTakeCallback<T> = ((items: T[]) => void) | ((items: T[]) => Promise<void>);

type SchedulerOptions<T> = {
  /**  whether to use requestIdleCallback for processing */
  useIdle?: boolean;
  /**  the number of items to process in each batch */
  batchSize?: number;
  /**  whether to block until the current batch is processed, useful for asynchronous processing */
  block?: boolean;
  /**  whether to ensure uniqueness of items in the queue */
  unique?: boolean;
  /**  hooks for customizing the processing behavior */
  hooks?: {
    /**  a callback function to call when taking items from the queue */
    onTake?: SchedulerOnTakeCallback<T>;
  };
};

/**
 * A queue that receives items and take them out in a delayed manner
 */
const createQueue = <T>(options?: QueueOptions) => {
  const items: Array<T> = [];
  const uniqueItems: Set<T> = new Set();

  /** get the size of current queue */
  const size = () => (options?.unique ? uniqueItems.size : items.length);

  return {
    /**
     * Adds an item to the queue.
     */
    add: (item: T) => {
      options?.unique ? uniqueItems.add(item) : items.push(item);
    },
    size,
    /**
     * Takes a specified number of items from the queue.
     * @param count items count to take, if the number of items in the queue is less than the count, all items will be taken
     */
    take: (count: number) => {
      count = count > size() ? size() : count;
      let tookItems: Array<T> = [];
      if (options?.unique) {
        for (let i = 0; i < count; i++) {
          tookItems.push(uniqueItems.values().next().value);
          uniqueItems.delete(tookItems[i]);
        }
      } else {
        tookItems = items.splice(0, count);
      }
      return tookItems;
    },
    destroy: () => {
      items.length = 0;
      uniqueItems.clear();
    }
  };
};

/**
 * Creates a scheduler that manages a queue of items and processes them in batches.
 */
export const createScheduler = <T>(options?: SchedulerOptions<T>) => {
  let _cancel: (() => any) | undefined = undefined;
  let _onTake: SchedulerOnTakeCallback<T> | undefined = options?.hooks?.onTake;
  const q = createQueue<T>({ unique: options?.unique });

  /**
   * Adds an item to the queue and triggers the next idle or frame processing.
   */
  const enqueue = (item: T) => {
    q.add(item);
    _next();
  };

  const _next = () => {
    if (!q.size()) return;
    if (_cancel) return;
    _cancel = nextTime(
      () => {
        _process();
        if (!options?.block) _next();
      },
      { useIdle: !!options?.useIdle }
    );
  };

  const _process = async () => {
    const items = q.take(options?.batchSize || 1);
    let t = window.performance.now();

    const result = _onTake?.(items);
    if (!!result && !!options?.block && isPromise(result)) {
      const p = result as Promise<void>;
      await p;
    }

    // if block, go to the next batch
    if (!!options?.block) _next();
  };

  /**
   * Sets the callback function to be called when taking items from the queue.
   */
  const onTake = (callback: SchedulerOnTakeCallback<T>) => {
    _onTake = callback;
  };

  const destroy = () => {
    q.destroy();
    _onTake = undefined;
    _cancel?.();
  };

  return { enqueue, onTake, destroy };
};

/**
 * Checks if a given value is a Promise.
 * @return {boolean} true if the value is a Promise, false otherwise
 */
const isPromise = (result: any): result is Promise<void> =>
  result instanceof Promise || ((result as any).then && typeof (result as any).then === 'function');
