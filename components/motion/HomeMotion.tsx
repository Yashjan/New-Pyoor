'use client';

import { useEffect } from 'react';
import { loadGsap } from '@/lib/motion/gsap';
import { SEQUENCE_START_VH } from '@/lib/motion/opening';
import { refreshOnce } from '@/lib/motion/unlock';
import { LABEL_TITLE, projectFilm } from '@/lib/motion/film';
import { jarStartX, layoutFor } from '@/lib/motion/heroCamera';
import { pourStore } from '@/lib/motion/pourStore';
import { PANS_VH, beforeEnd, openVh } from '@/lib/motion/pans';

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
 *   [data-hero]           the film's captions and progress line (lib/motion/film.ts), scrubbed
 *                         by its progress (after the Journey and the opening:
 *                         SEQUENCE_START_VH; before step 3, the salt pans: PANS_VH, whose
 *                         start fades them all out)
 */
export function HomeMotion() {
  useEffect(() => {
    if (!document.documentElement.classList.contains('motion')) return;
    let cancelled = false;
    let cleanup: (() => void) | undefined;

    loadGsap().then(({ gsap, ScrollTrigger }) => {
      if (cancelled) return;
      const q = <T extends Element = HTMLElement>(sel: string) => gsap.utils.toArray<T>(sel);
      const cleanups: (() => void)[] = [];

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
            { yPercent: amount, ease: 'none', scrollTrigger: { trigger: el, scrub: 0.6 } },
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
              scrollTrigger: { trigger: el.parentElement, scrub: 0.6 },
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
              scrollTrigger: { trigger: crystals.parentElement, scrub: 0.6 },
            },
          );
        }

        // ---- the film's captions: a paused timeline whose progress is the film's ----
        // (lib/motion/film.ts): shot 1's headline, shot 2's caption, shot 3's chapter line
        // meeting the label, shot 4's line as the stream starts, 4b's invitation, shot 5's
        const hero = document.querySelector<HTMLElement>('[data-hero]');
        if (hero) {
          const sel = (s: string) => hero.querySelector(s);
          const copy = hero.querySelectorAll(
            '[data-hero-copy], [data-label-cta], [data-turn-hint], [data-jar-ring]',
          );
          const onset = () => pourStore.shape()?.onset ?? 0.453;
          const build = () => {
            const tl = gsap.timeline({ paused: true });
            tl
              // shot 1: the backdrop in as the film starts, out as the camera moves in
              .fromTo(
                sel('[data-backdrop]'),
                { autoAlpha: 0 },
                { autoAlpha: 0.12, duration: 0.02, ease: 'none' },
                0,
              )
              .to(sel('[data-backdrop]'), { autoAlpha: 0, duration: 0.06, ease: 'none' }, 0.08)
              // the headline leaves as the camera moves in on the cap
              .to(copy, { autoAlpha: 0, y: -40, duration: 0.04, ease: 'power2.in' }, 0.07)
              // shot 2
              .fromTo(
                sel('[data-beat="1"]'),
                { autoAlpha: 0, y: 24 },
                { autoAlpha: 1, y: 0, duration: 0.03 },
                0.12,
              )
              .to(sel('[data-beat="1"]'), { autoAlpha: 0, y: -24, duration: 0.03 }, 0.25)
              // shot 3: the chapter line as the orbit ends (at the label's title)
              .fromTo(
                sel('[data-beat="2"]'),
                { autoAlpha: 0, y: 16 },
                { autoAlpha: 1, y: 0, duration: 0.04 },
                0.34,
              )
              // shot 4: its line as the stream starts
              .fromTo(
                sel('[data-beat-line]'),
                { autoAlpha: 0, y: 16 },
                { autoAlpha: 1, y: 0, duration: 0.03 },
                onset(),
              )
              .to(sel('[data-beat="2"]'), { autoAlpha: 0, y: -24, duration: 0.03 }, 0.72)
              // 4b: the invitation, once the mound has settled; gone as the dive begins
              .fromTo(
                sel('[data-invite]'),
                { autoAlpha: 0, y: 12 },
                { autoAlpha: 1, y: 0, duration: 0.025 },
                0.76,
              )
              .to(sel('[data-invite]'), { autoAlpha: 0, y: -12, duration: 0.02 }, 0.81)
              // shot 5
              .fromTo(
                sel('[data-beat="3"]'),
                { autoAlpha: 0, y: 30 },
                { autoAlpha: 1, y: 0, duration: 0.04 },
                0.85,
              )
              .to({}, { duration: 0.01 }, 0.99);
            return tl;
          };
          let beats = build();

          // shot 3: the chapter line "02 · The salt" on the label's "HERBAL BLACK SALT", and
          // 4b's panel beside the mound: projected with the film's own camera (pure), on resize
          const canvas = hero.querySelector<HTMLCanvasElement>('[data-jar-layer] canvas');
          const place = () => {
            const w = canvas?.clientWidth || window.innerWidth;
            const h = canvas?.clientHeight || window.innerHeight;
            const layout = layoutFor(w, h);
            const x0 = jarStartX(layout);
            const shape = pourStore.shape();
            const [, ly] = projectFilm(
              0.4,
              layout,
              w,
              h,
              [x0, LABEL_TITLE.y, LABEL_TITLE.z],
              shape,
            );
            hero.style.setProperty('--label-y', `${Math.round(ly - 8)}px`);
            const r = pourStore.get();
            if (r && !layout.portrait) {
              const [mx, my] = projectFilm(
                0.78,
                layout,
                w,
                h,
                [r.mound.x + (r.mound.hEnd / 0.7) * 0.9, r.mound.hEnd * 0.6, 0],
                shape,
              );
              hero.style.setProperty('--invite-x', `${Math.round(Math.min(w - 300, mx + 24))}px`);
              hero.style.setProperty('--invite-y', `${Math.round(my - 40)}px`);
            }
          };
          place();
          window.addEventListener('resize', place);
          const unsubPour = pourStore.subscribe(() => {
            place();
            const pr = beats.progress();
            beats.kill();
            beats = build();
            beats.progress(pr);
          });

          // step 3 begins (the pans engrave over the crystals): the last caption and the
          // progress line leave together
          const beatsBox = sel('[data-beats]');
          if (beatsBox)
            gsap.fromTo(
              beatsBox,
              { autoAlpha: 1 },
              {
                autoAlpha: 0,
                ease: 'none',
                immediateRender: false,
                scrollTrigger: {
                  trigger: hero,
                  start: () => beforeEnd(PANS_VH + openVh()),
                  end: () => beforeEnd(PANS_VH * 0.94 + openVh()),
                  scrub: true,
                  invalidateOnRefresh: true,
                },
              },
            );

          const railFill = hero.querySelector<HTMLElement>('[data-rail-fill]');
          ScrollTrigger.create({
            trigger: hero,
            start: () => `top+=${Math.round(window.innerHeight * SEQUENCE_START_VH)} top`,
            end: () => beforeEnd(PANS_VH + openVh()),
            scrub: 0.6,
            invalidateOnRefresh: true,
            onUpdate: (s) => {
              beats.progress(s.progress);
              // Back before the first beat: drop the inline styles GSAP leaves on the headline
              // block so it rasterises exactly as it did on load (identical reverse frames).
              if (s.progress < 0.005) {
                gsap.set(
                  hero.querySelectorAll(
                    '[data-hero-copy], [data-label-cta], [data-turn-hint], [data-jar-ring]',
                  ),
                  {
                    clearProps: 'transform,opacity,visibility',
                  },
                );
              }
              if (railFill) railFill.style.transform = `scaleY(${s.progress.toFixed(4)})`;
            },
          });
          cleanups.push(() => {
            window.removeEventListener('resize', place);
            unsubPour();
            beats.kill();
          });
        }
      });

      // Re-measure exactly once, after the fonts; nothing waits for the 3D model or images.
      void refreshOnce();

      cleanup = () => {
        cleanups.forEach((fn) => fn());
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
