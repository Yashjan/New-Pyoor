import { loadGsap } from './gsap';

let refreshed = false;

/** ScrollTrigger re-measures exactly once per page (after the fonts), never mid-scroll. */
export async function refreshOnce(): Promise<void> {
  if (refreshed) return;
  refreshed = true;
  const [{ ScrollTrigger }] = await Promise.all([loadGsap(), document.fonts?.ready]);
  ScrollTrigger.refresh();
}
