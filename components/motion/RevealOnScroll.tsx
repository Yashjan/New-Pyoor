'use client';

import { useEffect } from 'react';

/**
 * Light entrance motion: elements marked `data-reveal` fade and rise as they enter.
 *
 * - Content is visible by default (server HTML, no CSS hiding). Only elements that start
 *   below the fold are set to transparent, and only after GSAP has loaded, so nothing stays
 *   hidden if JS fails or is slow.
 * - Opacity only (no `visibility: hidden`), so keyboard focus still reaches hidden items;
 *   focusing scrolls them in, which reveals them.
 * - Skipped entirely for prefers-reduced-motion.
 * - GSAP is imported lazily so it stays out of the initial bundle.
 */
export function RevealOnScroll() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let cleanup: (() => void) | undefined;
    let cancelled = false;

    (async () => {
      const [{ gsap }, { ScrollTrigger }] = await Promise.all([
        import('gsap'),
        import('gsap/ScrollTrigger'),
      ]);
      if (cancelled) return;
      gsap.registerPlugin(ScrollTrigger);

      const ctx = gsap.context(() => {
        const fold = window.innerHeight;
        const targets = gsap.utils
          .toArray<HTMLElement>('[data-reveal]')
          .filter((el) => el.getBoundingClientRect().top > fold);
        if (targets.length === 0) return;

        gsap.set(targets, { opacity: 0, y: 28 });
        ScrollTrigger.batch(targets, {
          start: 'top 90%',
          once: true,
          onEnter: (batch) =>
            gsap.to(batch, {
              opacity: 1,
              y: 0,
              duration: 0.9,
              ease: 'power2.out',
              stagger: 0.08,
              overwrite: true,
              clearProps: 'opacity,transform', // leave nothing inline that could block hover styles
            }),
        });
      });

      cleanup = () => ctx.revert();
    })();

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, []);

  return null;
}
