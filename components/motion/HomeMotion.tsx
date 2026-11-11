'use client';

import { useEffect } from 'react';
import { loadGsap } from '@/lib/motion/gsap';
import { SEQUENCE_START_VH } from '@/lib/motion/opening';

/**
 * The homepage's scroll choreography (concept.html), set up once GSAP has loaded.
 *
 * Content is complete and visible in the server HTML; these tweens only start from hidden
 * states once JS runs, so nothing stays hidden if scripts fail. Nothing runs without
 * `html.motion` (reduced motion): the CSS then shows the static layout.
 *
 *   [data-split]          heading words rise out of their masks (not the hero h1: CSS intro)
 *   [data-fade]           fade and rise
 *   [data-draw]           the horizon draws in from the left
 *   [data-parallax]       placeholder labels drift
 *   [data-float]          product renders float and turn while their panel scrolls past
 *   [data-clip-reveal]    product panels open from an inset clip
 *   [data-crystals-bg]    the crystal texture settles from 1.35× to 1×
 *   [data-hero]           text beats and progress rail, scrubbed by the jar sequence's progress
 *                         (after the Journey and the opening: SEQUENCE_START_VH)
 */
export function HomeMotion() {
  useEffect(() => {
    if (!document.documentElement.classList.contains('motion')) return;
    let cancelled = false;
    let cleanup: (() => void) | undefined;

    loadGsap().then(({ gsap, ScrollTrigger }) => {
      if (cancelled) return;
      const q = <T extends Element = HTMLElement>(sel: string) => gsap.utils.toArray<T>(sel);

      const ctx = gsap.context(() => {
        // ---- reveals ----
        q('section:not([data-hero]) [data-split]').forEach((el) => {
          gsap.from(el.querySelectorAll('.py-ln > span'), {
            yPercent: 110,
            duration: 1.1,
            ease: 'expo.out',
            stagger: 0.05,
            scrollTrigger: { trigger: el, start: 'top 85%' },
          });
        });
        q('[data-fade]').forEach((el) =>
          gsap.from(el, {
            y: 22,
            opacity: 0,
            duration: 1,
            ease: 'power3.out',
            scrollTrigger: { trigger: el, start: 'top 88%' },
          }),
        );
        q('[data-draw]').forEach((el) =>
          gsap.from(el, {
            scaleX: 0,
            duration: 1.4,
            ease: 'expo.out',
            scrollTrigger: { trigger: el, start: 'top 85%' },
          }),
        );
        q('[data-parallax]').forEach((el) => {
          const amount = parseFloat(el.dataset.parallax ?? '0');
          gsap.fromTo(
            el.querySelector('[data-parallax-inner]') ?? el,
            { yPercent: -amount },
            { yPercent: amount, ease: 'none', scrollTrigger: { trigger: el, scrub: true } },
          );
        });
        q('[data-float]').forEach((el) =>
          gsap.fromTo(
            el,
            { y: 36, rotate: -3 },
            {
              y: -36,
              rotate: 2,
              ease: 'none',
              scrollTrigger: { trigger: el.parentElement, scrub: true },
            },
          ),
        );
        q('[data-clip-reveal]').forEach((el) =>
          gsap.from(el, {
            clipPath: 'inset(12% 12% 12% 12%)',
            duration: 1.4,
            ease: 'expo.out',
            scrollTrigger: { trigger: el, start: 'top 80%' },
          }),
        );
        const crystals = document.querySelector('[data-crystals-bg]');
        if (crystals) {
          gsap.fromTo(
            crystals,
            { scale: 1.35, rotate: -2 },
            {
              scale: 1,
              rotate: 0,
              ease: 'none',
              scrollTrigger: { trigger: crystals.parentElement, scrub: true },
            },
          );
        }

        // ---- hero beats: a paused timeline whose progress is the jar sequence's progress ----
        const hero = document.querySelector<HTMLElement>('[data-hero]');
        if (hero) {
          const sel = (s: string) => hero.querySelector(s);
          const beats = gsap.timeline({ paused: true });
          beats
            // the headline leaves before the camera moves in (on phones the jar grows over it)
            .to(
              sel('[data-hero-copy]'),
              { autoAlpha: 0, y: -40, duration: 0.06, ease: 'power2.in' },
              0.01,
            )
            .fromTo(
              sel('[data-beat="1"]'),
              { autoAlpha: 0, y: 30 },
              { autoAlpha: 1, y: 0, duration: 0.05 },
              0.1,
            )
            .to(sel('[data-beat="1"]'), { autoAlpha: 0, y: -30, duration: 0.05 }, 0.27)
            .fromTo(
              sel('[data-beat="2"]'),
              { autoAlpha: 0, y: 30 },
              { autoAlpha: 1, y: 0, duration: 0.06 },
              0.46,
            )
            .to(sel('[data-beat="2"]'), { autoAlpha: 0, y: -30, duration: 0.06 }, 0.66)
            .fromTo(
              sel('[data-beat="3"]'),
              { autoAlpha: 0, y: 40 },
              { autoAlpha: 1, y: 0, duration: 0.07 },
              0.87,
            )
            .to({}, { duration: 0.02 }, 0.98);

          const railText = sel('[data-rail-text]');
          const railFill = hero.querySelector<HTMLElement>('[data-rail-fill]');
          ScrollTrigger.create({
            trigger: hero,
            start: () => `top+=${Math.round(window.innerHeight * SEQUENCE_START_VH)} top`,
            end: 'bottom bottom',
            scrub: true,
            invalidateOnRefresh: true,
            onUpdate: (s) => {
              beats.progress(s.progress);
              // Back before the first beat: drop the inline styles GSAP leaves on the headline
              // block so it rasterises exactly as it did on load (identical reverse frames).
              if (s.progress < 0.005) {
                gsap.set(sel('[data-hero-copy]'), {
                  clearProps: 'transform,opacity,visibility',
                });
              }
              if (railFill) railFill.style.transform = `scaleX(${s.progress})`;
              if (railText)
                railText.textContent =
                  (s.progress < 0.4 ? '01' : s.progress < 0.8 ? '02' : '03') + ' / 03';
            },
          });
        }
      });

      // Fonts and images change layout: re-measure once everything has loaded.
      const refresh = () => ScrollTrigger.refresh();
      if (document.readyState === 'complete') refresh();
      else window.addEventListener('load', refresh, { once: true });
      document.fonts?.ready.then(refresh);

      cleanup = () => {
        window.removeEventListener('load', refresh);
        ctx.revert();
      };
    });

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, []);

  return null;
}
