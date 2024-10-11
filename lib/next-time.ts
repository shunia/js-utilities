/**
 * A simple next frame impl that could choose between requestAnimationFrame and requestIdleCallback, if none available, would use setTimeout instead.
 */
export const nextTime = (callback: () => any, options?: { useIdle?: boolean }) => {
  let cancel: (() => any) | undefined = undefined;

  if (options?.useIdle && requestIdleCallback) {
    const id = requestIdleCallback(callback);
    cancel = () => cancelIdleCallback(id);
  } else if (requestAnimationFrame) {
    const id = requestAnimationFrame(callback);
    cancel = () => cancelAnimationFrame(id);
  } else {
    const id = setTimeout(callback, 0);
    cancel = () => clearTimeout(id);
  }

  return () => cancel?.();
};
