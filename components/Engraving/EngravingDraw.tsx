'use client';

import { useEffect, useRef } from 'react';

const DURATION = 1800;
const ease = (t: number) => 1 - Math.pow(1 - t, 3);

/** Draws its parent engraving once, when a quarter of it is in view. Motion only. */
export function EngravingDraw() {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const root = ref.current?.parentElement;
    const svg = root?.querySelector('svg');
    if (!root || !svg || !document.documentElement.classList.contains('motion')) return;
    for (const p of svg.querySelectorAll<SVGPathElement>('path:not(.p)')) {
      const m = Number(p.dataset.m) || Math.ceil(p.getTotalLength()) + 1;
      const t = Number(p.dataset.t) || 1;
      p.style.setProperty('--m', String(m));
      p.style.setProperty('--d', String(Math.min(0.5, (t - 1) / 14)));
    }
    root.style.setProperty('--u', '0');
    root.setAttribute('data-ready', '');
    let raf = 0;
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e?.isIntersecting) return;
        io.disconnect();
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
    io.observe(root);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, []);
  return <span ref={ref} hidden />;
}
