'use client';

import { useEffect, useRef } from 'react';
import { loadGsap } from '@/lib/motion/gsap';

/**
 * 06 · Our roots, scrubbed (fractions of the section's scroll, from its top at 70% of the
 * screen to its bottom at the bottom; the stage is pinned by CSS: position sticky):
 *
 *   0–.15    the envelope glides up (−4° → 0°), its shadow with it; the heading above
 *   .15–.30  the wax seal cracks (the line draws), its halves part and drop, a few crumbs
 *   .30–.45  the flap opens (rotateX 0 → −170°, from its top edge)
 *   .45–.60  the letter slides up out of it; the envelope slides down and goes
 *   .60–.80  the letter unfolds its three panels, then settles at its reading size
 *   .80–.95  its lines fade up, the signature writes itself (a slanted wipe), the P.S.
 *   .95–1    "Write back to us"; the pin releases at 1
 *
 * Transform, opacity, clip-path and stroke-dashoffset only; nothing here changes layout.
 */
export function RootsMotion() {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const root = ref.current?.closest<HTMLElement>('[data-roots]');
    if (!root || !document.documentElement.classList.contains('motion')) return;
    let kill: (() => void) | undefined;
    let cancelled = false;
    void loadGsap().then(({ gsap }) => {
      if (cancelled) return;
      const $ = <T extends Element = HTMLElement>(s: string) => root.querySelector<T>(s)!;
      const $$ = (s: string) => [...root.querySelectorAll<HTMLElement>(s)];
      const env = [$('[data-env]'), $('[data-env-front]')];
      const flap = $('[data-flap]');
      const head = $('[data-roots-head]');
      const letter = $('[data-letter]');
      const p1 = $('[data-panel="1"]');
      const p3 = $('[data-panel="3"]');
      const crack = $<SVGPathElement>('[data-crack]');
      const halfL = $('[data-seal-half="l"]');
      const halfR = $('[data-seal-half="r"]');
      const crumbs = $$('[data-crumb]');
      const lines = $$('[data-letter] [data-line]');
      const sign = $('[data-sign]');
      const write = $('[data-write]');
      const eh = () => root.querySelector<HTMLElement>('[data-env]')!.offsetHeight || 400;

      const tl = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: {
          trigger: root,
          start: 'top 70%',
          end: 'bottom bottom',
          scrub: 0.5,
        },
        onUpdate: () => {
          // past 90°, the flap is behind the letter
          flap.toggleAttribute('data-open', tl.progress() > 0.37);
        },
      });
      // 1: the envelope arrives
      tl.fromTo(
        [...env, flap],
        { y: () => window.innerHeight * 0.55, rotation: -4, opacity: 0 },
        { y: 0, rotation: 0, opacity: 1, duration: 0.15, ease: 'power2.out' },
        0,
      );
      tl.fromTo(
        letter,
        { y: () => window.innerHeight * 0.55, rotation: -4, scale: 0.86 },
        { y: 0, rotation: 0, duration: 0.15, ease: 'power2.out' },
        0,
      );
      tl.set(p1, { rotationX: -180 }, 0);
      tl.set(p3, { rotationX: 180 }, 0);
      tl.fromTo(head, { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.08 }, 0.04);
      // 2: the seal cracks, its halves part and drop
      tl.fromTo(crack, { strokeDashoffset: 70 }, { strokeDashoffset: 0, duration: 0.07 }, 0.15);
      tl.to(halfL, { x: -10, y: 26, rotation: -14, duration: 0.08, ease: 'power2.in' }, 0.22);
      tl.to(halfR, { x: 10, y: 30, rotation: 12, duration: 0.08, ease: 'power2.in' }, 0.22);
      tl.to(crack, { opacity: 0, duration: 0.03 }, 0.22);
      crumbs.forEach((c, i) =>
        tl.fromTo(
          c,
          { x: 0, y: 0, opacity: 0 },
          {
            keyframes: [
              { opacity: 1, duration: 0.01 },
              { x: (i - 2) * 9, y: 30 + (i % 3) * 10, opacity: 0, duration: 0.07 },
            ],
          },
          0.22 + i * 0.005,
        ),
      );
      tl.to([halfL, halfR], { opacity: 0, duration: 0.03 }, 0.28);
      // 3: the flap opens
      tl.fromTo(
        flap,
        { rotationX: 0 },
        { rotationX: -170, duration: 0.15, ease: 'power1.inOut' },
        0.3,
      );
      // 4: the letter comes out; the envelope goes
      tl.to(letter, { y: () => -eh() * 0.62, duration: 0.1, ease: 'power1.inOut' }, 0.45);
      tl.to(
        [...env, flap],
        { y: () => window.innerHeight * 0.5, opacity: 0, duration: 0.12, ease: 'power1.in' },
        0.48,
      );
      tl.to(letter, { y: 0, duration: 0.05, ease: 'power1.inOut' }, 0.56);
      // 5: it unfolds, then settles at its reading size; the heading makes room
      tl.to(head, { opacity: 0, y: -12, duration: 0.05 }, 0.31);
      tl.to(p1, { rotationX: 0, duration: 0.12, ease: 'power2.inOut' }, 0.6);
      tl.to(p3, { rotationX: 0, duration: 0.12, ease: 'power2.inOut' }, 0.66);
      tl.to(letter, { scale: 1, duration: 0.08, ease: 'power2.out' }, 0.72);
      // 6: the words, line by line; the signature signs itself; the P.S.
      const words = lines.filter((l) => !l.matches('[class*="ps"]'));
      const ps = lines.filter((l) => l.matches('[class*="ps"]'));
      words.forEach((l, i) =>
        tl.fromTo(l, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.04 }, 0.8 + i * 0.025),
      );
      tl.fromTo(
        sign,
        { opacity: 1, clipPath: 'polygon(0% 0%, 0% 0%, -12% 100%, -12% 100%)' },
        {
          clipPath: 'polygon(0% 0%, 112% 0%, 100% 100%, -12% 100%)',
          duration: 0.06,
          ease: 'power1.inOut',
        },
        0.86,
      );
      ps.forEach((l) =>
        tl.fromTo(l, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.03 }, 0.92),
      );
      // 7: write back
      tl.fromTo(write, { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: 0.05 }, 0.95);
      kill = () => {
        tl.scrollTrigger?.kill();
        tl.kill();
      };
    });
    return () => {
      cancelled = true;
      kill?.();
    };
  }, []);
  return <span ref={ref} hidden />;
}
