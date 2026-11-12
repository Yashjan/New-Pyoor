/**
 * Whether something (the site menu) fully covers the page. While it does, the homepage's 3D
 * scene stops rendering and the Journey's ambient loops pause; CSS loops pause under
 * html[data-page-covered]. Nothing here touches scroll or ScrollTrigger.
 */
let covered = false;
const listeners = new Set<() => void>();

export const coveredStore = {
  get: () => covered,
  set(next: boolean) {
    if (next === covered) return;
    covered = next;
    document.documentElement.toggleAttribute('data-page-covered', next);
    listeners.forEach((fn) => fn());
  },
  subscribe(fn: () => void) {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
};
