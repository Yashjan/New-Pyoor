'use client';

import { useEffect, useRef } from 'react';
import { whenCalm } from '@/lib/three/calm';

const DURATION = 1800;
const ease = (t: number) => 1 - Math.pow(1 - t, 3);

/**
 * Draws its parent engraving once, when a quarter of it is in view. Motion only. Its lines are
 * measured (getTotalLength) as it approaches, in a calm moment, never during the first load.
 */
export function EngravingDraw() {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const root = ref.current?.parentElement;
    const svg = root?.querySelector('svg');
    if (!root || !svg || !document.documentElement.classList.contains('motion')) return;
    const controller = new AbortController();
    let raf = 0;
    const draw = new IntersectionObserver(
      ([e]) => {
        if (!e?.isIntersecting) return;
        draw.disconnect();
        const t0 = performance.now();
        const tick = (now: number) => {
          const k = Math.min(1, (now - t0) / DURATION);
          root.style.setProperty('--u', ease(k).toFixed(4));
          if (k < 1) raf = requestAnimationFrame(tick);
          else root.setAttribute('data-drawn', '');
        };
        raf = requestAnimationFrame(tick);
      },
      { threshold: 0.25 },
    );
    const near = new IntersectionObserver(
      ([e]) => {
        if (!e?.isIntersecting) return;
        near.disconnect();
        void whenCalm(controller.signal)
          .then(() => {
            for (const p of svg.querySelectorAll<SVGPathElement>('path:not(.p)')) {
              const m = Number(p.dataset.m) || Math.ceil(p.getTotalLength()) + 1;
              const t = Number(p.dataset.t) || 1;
              p.style.setProperty('--m', String(m));
              p.style.setProperty('--d', String(Math.min(0.5, (t - 1) / 14)));
            }
            root.style.setProperty('--u', '0');
            root.setAttribute('data-ready', '');
            draw.observe(root);
          })
          .catch(() => {});
      },
      { rootMargin: '150% 0px' },
    );
    near.observe(root);
    return () => {
      controller.abort();
      near.disconnect();
      draw.disconnect();
      cancelAnimationFrame(raf);
    };
  }, []);
  return <span ref={ref} hidden />;
}
