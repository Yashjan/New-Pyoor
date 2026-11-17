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
  // a target in the hero's pinned stage marked data-pin-end (the products' opening): where the
  // pin comes to rest
  const hero = el.hasAttribute('data-pin-end') ? el.closest<HTMLElement>('[data-hero]') : null;
  if (hero && document.documentElement.classList.contains('motion')) {
    const y = hero.offsetTop + hero.offsetHeight - window.innerHeight;
    if (instance) instance.scrollTo(y, { force: true });
    else window.scrollTo({ top: y, behavior: 'smooth' });
    return true;
  }
  // force: the mobile menu stops Lenis while it is open; its links still need to scroll.
  if (instance) instance.scrollTo(el, { offset: -40, force: true });
  else el.scrollIntoView({ behavior: 'smooth' });
  return true;
}
