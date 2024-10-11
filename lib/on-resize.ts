/**
 * Listen to dom element resize by leveraging ResizeObserver.
 *
 * Normally, you would use the resize event in window to work, but sometimes it's much more convenient to just listen to element resize. The browser has offered ResizeObserver API for this purpose but it's always quite cumbersome to use.
 *
 * For example, you might need to wrap the callback to avoid potential issues with "this" context, or to prevent callback hell in the business logics.
 *
 * And what's more is that you may always need to re-read the document to think about why the observer would return an array rather than a single item, and then read about the detail properties in the entry object.
 *
 * I always get into these situations since I'm bad in memory, so I write this utitlity to overcome these problems.
 *
 * And what's more, I think the api has some flaws since the size report it not performant enough as it will report decimal values which is usally not needed when the resize callback is doing some heavy computation, and then you may need to work around it by importing debounce or throttle logic into your code.
 *
 * @param el a reference to the HTML element that will be resized
 *
 * @link ResizeObserver: https://developer.mozilla.org/en-US/docs/Web/API/ResizeObserver
 */
export const onResize = (el: HTMLElement, callback: () => any) => {
  let lastSize = [-1, -1];
  const ob = new ResizeObserver((entries) => {
    // I don't know, I might be stupid here
    if (entries[0].target !== el) return;

    // skip the size report from entries, and use the clientWidth and clientHeight properties instead, they are quite stable
    const currentSize = [el.clientWidth, el.clientHeight];
    if (currentSize[0] === lastSize[0] && currentSize[1] === lastSize[1])
      return;

    // Update the existing array
    lastSize[0] = currentSize[0];
    lastSize[1] = currentSize[1];

    // size actually changed
    callback();
  });
  ob.observe(el);
  // if at anytime you want to stop observing
  return () => ob.disconnect();
};
