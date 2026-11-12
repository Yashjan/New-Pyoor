import type { gsap as GSAP } from 'gsap';
import type { ScrollTrigger as ScrollTriggerType } from 'gsap/ScrollTrigger';

export interface GsapModules {
  gsap: typeof GSAP;
  ScrollTrigger: typeof ScrollTriggerType;
}

let loading: Promise<GsapModules> | null = null;

/** Loads GSAP + ScrollTrigger once, lazily, so they stay out of the first-paint bundle. */
export function loadGsap(): Promise<GsapModules> {
  loading ??= Promise.all([import('gsap'), import('gsap/ScrollTrigger')]).then(
    ([{ gsap }, { ScrollTrigger }]) => {
      gsap.registerPlugin(ScrollTrigger);
      // the phone address bar showing/hiding must not re-measure (and jump) the page
      ScrollTrigger.config({ ignoreMobileResize: true });
      // every trigger's start and end in px (tests/scroll.spec.ts: they must not drift)
      (window as { __pyoorTriggers?: () => [number, number][] }).__pyoorTriggers = () =>
        ScrollTrigger.getAll().map((t) => [Math.round(t.start), Math.round(t.end)]);
      return { gsap, ScrollTrigger };
    },
  );
  return loading;
}
