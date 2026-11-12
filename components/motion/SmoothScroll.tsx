'use client';

import { useEffect } from 'react';
import { loadGsap } from '@/lib/motion/gsap';
import { lenisStore, scrollToHash } from '@/lib/motion/lenis';
import { introIsFull } from '@/lib/loader/progress';

/**
 * Lenis smooth scroll, driven by GSAP's ticker so ScrollTrigger and Lenis share one clock.
 * Off under prefers-reduced-motion (brand book §9: no smooth scroll, fades only).
 * Same-page anchor links (/#shop, /#roots…) scroll through Lenis.
 */
export function SmoothScroll() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let cancelled = false;
    let cleanup: (() => void) | undefined;

    (async () => {
      const [{ gsap, ScrollTrigger }, { default: Lenis }] = await Promise.all([
        loadGsap(),
        import('lenis'),
      ]);
      if (cancelled) return;

      const lenis = new Lenis({
        lerp: 0.1,
        smoothWheel: true,
        syncTouch: false, // phones keep native touch scrolling
        autoRaf: false,
      });
      lenis.on('scroll', ScrollTrigger.update);
      const tick = (time: number) => lenis.raf(time * 1000);
      gsap.ticker.add(tick);
      gsap.ticker.lagSmoothing(0);
      // Hold scrolling under the first-visit opening; SambharOpening starts Lenis after the glint.
      if (introIsFull()) lenis.stop();
      lenisStore.set(lenis);

      const onClick = (e: MouseEvent) => {
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
        const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
        if (!a) return;
        const url = new URL(a.href, window.location.href);
        if (url.pathname !== window.location.pathname || !url.hash) return;
        if (scrollToHash(url.hash)) {
          e.preventDefault();
          history.replaceState(null, '', url.hash);
        }
      };
      // Capture phase: runs before next/link, which skips navigation once default is prevented.
      document.addEventListener('click', onClick, true);

      cleanup = () => {
        document.removeEventListener('click', onClick, true);
        gsap.ticker.remove(tick);
        lenis.destroy();
        lenisStore.set(null);
      };
    })();

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, []);

  return null;
}
