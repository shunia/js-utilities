/**
 * A simple timer.
 *
 * Can use frame time rather than setTimeout/setInterval if options.useFrame set to true, could be useful in some cases.
 */
export const timer = (callback: () => any, timeInMS: number, interval?: boolean, options?: { useFrame?: boolean }) => {
  if (timeInMS < 0) timeInMS = 0;

  let id = -1;

  if (!!options?.useFrame) {
    let timeEllapsed = 0;

    const tick = () => {
      id = window.requestAnimationFrame((t) => {
        timeEllapsed += t;

        if (timeEllapsed >= timeInMS) {
          callback();
          if (!!interval) {
            timeEllapsed -= timeInMS;
            tick();
          }
        }
      });
    };

    return () => window.cancelAnimationFrame(id);
  }

  if (!!interval) id = setInterval(callback, timeInMS);
  else id = setTimeout(callback, timeInMS);

  return () => (!!interval ? clearInterval(id) : clearTimeout(id));
};
