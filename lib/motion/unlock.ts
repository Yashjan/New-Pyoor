import { loadGsap } from './gsap';
import { lenisStore } from './lenis';

let refreshed = false;

/** ScrollTrigger re-measures exactly once per page (after the fonts), never mid-scroll. */
export async function refreshOnce(): Promise<void> {
  if (refreshed) return;
  refreshed = true;
  const [{ ScrollTrigger }] = await Promise.all([loadGsap(), document.fonts?.ready]);
  ScrollTrigger.refresh();
}

/**
 * Lets the visitor scroll (the instant the loader's ink fill completes): re-measure once, then
 * start Lenis from where the page is. Input while locked was ignored, never buffered.
 */
export async function unlockScroll(): Promise<void> {
  await refreshOnce();
  document.documentElement.style.removeProperty('overflow');
  const lenis = lenisStore.get();
  if (!lenis) return;
  lenis.resize();
  lenis.scrollTo(window.scrollY, { immediate: true, force: true });
  lenis.start();
}
