'use client';

import Image from 'next/image';
import { useEffect, useRef } from 'react';
import { loadProgress, onLoadProgress, reportLoad } from '@/lib/loader/progress';
import { lenisStore } from '@/lib/motion/lenis';
import { loadGsap } from '@/lib/motion/gsap';
import styles from './IntroLoader.module.css';

const MIN_MS = 900;
const MAX_MS = 2500;
const EXIT_S = 1.1;
/** When the hero's own intro starts, measured from the start of the exit. */
const HERO_INTRO_AT_S = 0.7;
const STORAGE_KEY = 'pyoor-intro';
/** GSAP's expo.inOut as a CSS easing. */
const EXPO_IN_OUT = 'cubic-bezier(0.87, 0, 0.13, 1)';

/**
 * The homepage's first-visit loader. `html[data-intro]` (set before first paint in
 * app/layout.tsx) decides what happens:
 *   full  first visit this session, motion allowed: logo + gold progress line, then the exit
 *         (logo flies into the header slot, line becomes the hero's horizon, curtain lifts)
 *   fade  later visits and reduced motion: the curtain fades out in 0.3 s (CSS only)
 *   unset no JS: the overlay never shows
 * The page is server-rendered underneath; this overlay is decorative (aria-hidden) and
 * <main> carries aria-busy until the reveal.
 */
export function IntroLoader() {
  const rootRef = useRef<HTMLDivElement>(null);
  const curtainRef = useRef<HTMLDivElement>(null);
  const logoRef = useRef<HTMLDivElement>(null);
  const tagRef = useRef<HTMLParagraphElement>(null);
  const lineRef = useRef<HTMLDivElement>(null);
  const fillRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const html = document.documentElement;
    const main = document.getElementById('main');
    const mode = html.dataset.intro;
    if (mode !== 'full' || html.hasAttribute('data-intro-done')) {
      main?.removeAttribute('aria-busy');
      return;
    }
    const root = rootRef.current;
    if (!root) return;
    root.dataset.running = ''; // JS is in charge: switch off the CSS failsafe
    root.dataset.phase = 'loading'; // loading → exit → done (also read by the screenshot script)

    let cancelled = false;
    let animations: Animation[] = [];

    const setFill = (p: number) => {
      if (fillRef.current) fillRef.current.style.transform = `scaleX(${p})`;
    };
    setFill(loadProgress());
    const unsubscribe = onLoadProgress(setFill);

    void document.fonts.ready.then(() => reportLoad('fonts', 1));
    // GSAP drives the page's scroll motion; the loader only waits for it as part of progress.
    void loadGsap().then(
      () => reportLoad('gsap', 1),
      () => reportLoad('gsap', 1),
    );

    // Reveal when everything has loaded and at least MIN_MS has passed, or at MAX_MS anyway
    // (the hero poster covers for a jar that is still loading). Times count from navigation.
    const ready = new Promise<void>((resolve) => {
      let off = () => {};
      let tMin = 0;
      let tMax = 0;
      const done = () => {
        off();
        window.clearTimeout(tMin);
        window.clearTimeout(tMax);
        resolve();
      };
      const check = () => {
        const t = performance.now();
        if ((loadProgress() >= 1 && t >= MIN_MS) || t >= MAX_MS) done();
      };
      off = onLoadProgress(check);
      tMin = window.setTimeout(check, Math.max(0, MIN_MS - performance.now()));
      tMax = window.setTimeout(done, Math.max(0, MAX_MS - performance.now()));
      check();
    });

    const finish = () => {
      root.dataset.phase = 'done';
      html.setAttribute('data-intro-play', '');
      html.setAttribute('data-intro-done', '');
      main?.removeAttribute('aria-busy');
      lenisStore.get()?.start();
    };

    void (async () => {
      await ready;
      if (cancelled) return;
      try {
        sessionStorage.setItem(STORAGE_KEY, '1');
      } catch {
        // Storage blocked: the next visit gets the full intro again, which is harmless.
      }
      setFill(1);
      root.dataset.phase = 'exit';

      const logo = logoRef.current!;
      const line = lineRef.current!;
      const curtain = curtainRef.current!;
      const tag = tagRef.current!;
      const slot = document.querySelector<HTMLElement>('[data-header-logo] img');
      const horizon = document.querySelector<HTMLElement>('[data-hero-horizon]');

      // FLIP: measure the header slot and fly the logo onto it.
      const from = logo.getBoundingClientRect();
      const to = slot?.getBoundingClientRect();
      const fly = to
        ? {
            x: to.left + to.width / 2 - (from.left + from.width / 2),
            y: to.top + to.height / 2 - (from.top + from.height / 2),
            scale: to.height / from.height,
          }
        : { x: 0, y: -from.top, scale: 0.5 };
      const lineBox = line.getBoundingClientRect();
      const horizonY = horizon?.getBoundingClientRect().top ?? window.innerHeight * 0.73;

      // Web Animations rather than GSAP, so the reveal never waits for a module download.
      const exit = { duration: EXIT_S * 1000, easing: EXPO_IN_OUT, fill: 'forwards' } as const;
      const anims = [
        logo.animate(
          [
            { transform: 'none' },
            { transform: `translate(${fly.x}px, ${fly.y}px) scale(${fly.scale})` },
          ],
          exit,
        ),
        tag.animate([{ opacity: 1 }, { opacity: 0, transform: 'translateY(-10px)' }], {
          duration: 450,
          easing: 'cubic-bezier(0.55, 0, 1, 0.45)',
          fill: 'forwards',
        }),
        line.animate(
          [
            { width: `${lineBox.width}px`, transform: 'none' },
            {
              width: `${window.innerWidth}px`,
              transform: `translateY(${horizonY - lineBox.top}px)`,
            },
          ],
          exit,
        ),
        line.animate([{ opacity: 1 }, { opacity: 0 }], {
          duration: 300,
          delay: (EXIT_S - 0.3) * 1000,
          fill: 'forwards',
        }),
        curtain.animate(
          [{ clipPath: 'inset(0% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 100% 0%)' }],
          exit,
        ),
      ];
      // The hero's intro is released on the same animation timeline (not a timer), so it
      // stays in step with the exit even when the main thread stalls.
      const heroCue = root.animate([{ opacity: 1 }, { opacity: 1 }], HERO_INTRO_AT_S * 1000);
      void heroCue.finished.then(
        () => html.setAttribute('data-intro-play', ''),
        () => {},
      );
      animations = [...anims, heroCue];
      try {
        await Promise.all(anims.map((a) => a.finished));
      } catch {
        // cancelled (unmount): the cleanup below finishes the reveal
      }
      if (!cancelled) finish();
    })();

    return () => {
      cancelled = true;
      unsubscribe();
      animations.forEach((a) => a.cancel());
      // Leaving mid-intro (client navigation): don't strand the page behind the overlay.
      if (!html.hasAttribute('data-intro-done')) finish();
    };
  }, []);

  return (
    <div ref={rootRef} className={styles.loader} aria-hidden="true" data-intro-loader>
      <div ref={curtainRef} className={styles.curtain} />
      <div className={styles.center}>
        <div ref={logoRef} className={styles.logo}>
          <Image
            src="/brand/pyoor-logo.png"
            alt=""
            width={629}
            height={264}
            sizes="(max-width: 860px) 160px, 210px"
            loading="eager"
            fetchPriority="high"
          />
        </div>
        <div ref={lineRef} className={styles.line}>
          <div ref={fillRef} className={styles.fill} />
        </div>
        <p ref={tagRef} className={`py-eyebrow ${styles.tag}`}>
          Sambhar Lake · Rajasthan
        </p>
      </div>
    </div>
  );
}
