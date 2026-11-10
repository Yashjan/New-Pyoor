import type Lenis from 'lenis';

/**
 * The page's Lenis instance, if smooth scrolling is on (it is off under reduced motion).
 * Components use this to pause scrolling (menu, bag) or to scroll to an anchor.
 */
let instance: Lenis | null = null;

export const lenisStore = {
  get: () => instance,
  set: (l: Lenis | null) => {
    instance = l;
  },
};

/** Scroll to an in-page anchor with Lenis if it's running, natively otherwise. */
export function scrollToHash(hash: string): boolean {
  const el = hash.length > 1 ? document.querySelector<HTMLElement>(hash) : null;
  if (hash === '#top') {
    if (instance) instance.scrollTo(0, { force: true });
    else window.scrollTo({ top: 0, behavior: 'smooth' });
    return true;
  }
  if (!el) return false;
  // force: the mobile menu stops Lenis while it is open; its links still need to scroll.
  if (instance) instance.scrollTo(el, { offset: -40, force: true });
  else el.scrollIntoView({ behavior: 'smooth' });
  return true;
}
