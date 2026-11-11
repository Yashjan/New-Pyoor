'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { ButtonLink } from '@/components/Button/Button';
import { Horizon } from '@/components/Horizon/Horizon';
import { SambharOpening } from '@/components/opening/SambharOpening';
import { Journey } from '@/components/sections/Journey/Journey';
import { prefetchWithProgress, whenIntroDone } from '@/lib/loader/prefetch';
import { introIsFull, reportLoad } from '@/lib/loader/progress';
import { SEQUENCE_START_VH } from '@/lib/motion/opening';
import { modelUrl } from '@/lib/three/models';
import { pickQualityTier } from '@/lib/three/quality';
import styles from './JarHero.module.css';
import { asset } from '@/lib/basePath';

const MODEL_URL = modelUrl('pyoor-herbal-black-salt.glb');

/**
 * The jar sequence's progress 0–1: how far the pinned section has been scrolled through after
 * the Journey panorama and the opening (the first SEQUENCE_START_VH viewport heights).
 */
function heroProgress(section: HTMLElement): number {
  const rect = section.getBoundingClientRect();
  const open = window.innerHeight * SEQUENCE_START_VH;
  const range = rect.height - window.innerHeight - open;
  return range > 0 ? Math.min(1, Math.max(0, (-rect.top - open) / range)) : 0;
}

/**
 * The signature moment (concept.html), after the opening (SAMBHAR engraved, the horizon
 * opening, the jar rising out of it: components/opening): the jar floats, the cap unscrews and flies off, the jar
 * tips ~113° and pours ~6,000 crystals into a heap, the heap spreads into the salt flats of
 * Sambhar Lake under a gold horizon. Everything is a pure function of scroll progress.
 *
 * - Headline and buttons are server-rendered and usable from the first frame.
 * - three.js and the model load after first paint; the poster shows until the first 3D frame.
 * - Under reduced motion (or without JS) the hero is one static screen with the poster, and
 *   the three beats stack below it (CSS keyed on `html.motion`).
 * - The text beats and the progress rail are scrubbed by HomeMotion.
 */
export function JarHero({ fromPrice }: { fromPrice: string | null }) {
  const sectionRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [posterGone, setPosterGone] = useState(false);

  // Reduced motion: when the beats come into view, the closed jar crossfades (0.6 s) to the
  // pour's last frame.
  useEffect(() => {
    const section = sectionRef.current;
    if (!section || document.documentElement.classList.contains('motion')) return;
    const beat = section.querySelector('[data-beat="2"]');
    if (!beat) return;
    const io = new IntersectionObserver(([e]) => {
      if (!e?.isIntersecting) return;
      section.classList.add(styles.poured!);
      io.disconnect();
    });
    io.observe(beat);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const section = sectionRef.current;
    const canvas = canvasRef.current;
    if (!section || !canvas) return;
    const tier = document.documentElement.classList.contains('motion') ? pickQualityTier() : null;
    if (!tier) {
      // No 3D on this device: nothing for the loader to wait for.
      reportLoad('three', 1);
      reportLoad('model', 1);
      return;
    }

    const controller = new AbortController();
    let dispose: (() => void) | undefined;

    // Start after the page has painted and gone idle, so the text and buttons come first.
    // Under the first-visit intro: download the model and three.js straight away (that is the
    // intro's real progress), but build the scene only after the reveal, so its heavy setup
    // (context, environment, shader compile) never stalls the intro. The poster, placed where
    // the 3D jar renders, stands in until then.
    // During the engraving only downloads happen: the GLB into the HTTP cache. three.js isn't
    // even imported (parsing and running it would stall the main thread), so it doesn't hold
    // the loader either.
    const intro = introIsFull();
    if (intro) {
      reportLoad('three', 1);
      void prefetchWithProgress(MODEL_URL, (f) => reportLoad('model', f), controller.signal).catch(
        () => reportLoad('model', 1),
      );
    }
    const start = async () => {
      if (intro) {
        await whenIntroDone(controller.signal);
        // let the hero's own intro play first, then build in the next idle moment
        await new Promise<void>((resolve) =>
          window.requestIdleCallback
            ? window.requestIdleCallback(() => resolve(), { timeout: 2000 })
            : window.setTimeout(resolve, 1200),
        );
      }
      if (controller.signal.aborted) return;
      const { createJarScene } = await import('./scene/createJarScene');
      reportLoad('three', 1);
      if (controller.signal.aborted) return;
      try {
        const scene = await createJarScene({
          canvas,
          tier,
          modelUrl: MODEL_URL,
          getProgress: () => heroProgress(section),
          onFirstFrame: () => setPosterGone(true),
          onModelProgress: intro ? undefined : (f) => reportLoad('model', f),
          signal: controller.signal,
        });
        if (controller.signal.aborted) scene.dispose();
        else dispose = scene.dispose;
      } catch (err) {
        reportLoad('model', 1); // don't hold the loader for a model that failed
        if ((err as Error).name !== 'AbortError') console.error('Jar hero failed to start', err);
      }
    };
    const useIdle = !intro && !!window.requestIdleCallback;
    const idle = useIdle
      ? window.requestIdleCallback(() => void start(), { timeout: 1200 })
      : window.setTimeout(() => void start(), intro ? 0 : 200);

    return () => {
      controller.abort();
      if (useIdle) window.cancelIdleCallback(idle);
      else window.clearTimeout(idle);
      dispose?.();
    };
  }, []);

  return (
    <section
      ref={sectionRef}
      id="hero"
      className={styles.hero}
      aria-label="Pyoor Herbal Black Salt"
      data-hero
    >
      {/* where the header's Journey link lands */}
      <span id="journey" className={styles.journeyAnchor} />
      {/* --seam is set on the stage before hydration (SambharOpening's pre-paint script) */}
      <div className={styles.stage} suppressHydrationWarning>
        {/* behind the jar: the dawn glow in the opening, and a fine grain against banding */}
        <div className={styles.glow} aria-hidden="true" data-opening-glow />
        <div className={styles.grain} aria-hidden="true" />
        <div className={styles.jarLayer} data-jar-layer>
          <div className={styles.jarMask} data-jar-mask>
            <div className={styles.jarBack} data-jar-back>
              <canvas ref={canvasRef} className={styles.gl} aria-hidden="true" />
              <Image
                className={`${styles.poster} ${posterGone ? styles.gone : ''}`}
                src={asset('/images/renders/jar-black.webp')}
                alt="Pyoor Herbal Black Salt jar"
                width={1206}
                height={1570}
                sizes="(max-width: 860px) 56vw, min(30vw, 380px)"
                loading="eager"
              />
              {/* reduced motion: no pour; the closed jar crossfades to its end (jar, cap, mound) */}
              <Image
                className={styles.posterFinal}
                src={asset('/images/renders/jar-pour-final.webp')}
                alt=""
                width={2320}
                height={980}
                sizes="(max-width: 860px) 90vw, 50vw"
                loading="lazy"
              />
            </div>
          </div>
        </div>

        <SambharOpening />

        <Journey />

        {/* the outer block is faded by the jar sequence, the inner one by the opening */}
        <div className={styles.copy} data-hero-copy>
          <div className={styles.copyIn} data-copy-in>
            <h1 className={`py-display py-d-l ${styles.h1}`}>Salt, the way the lake makes it.</h1>
            <div className={styles.cta}>
              <ButtonLink variant="primary" href="/#shop">
                {fromPrice ? `Shop the salts — from ${fromPrice}` : 'Shop the salts'}
              </ButtonLink>
              <ButtonLink variant="link" href="/#roots">
                Our story
              </ButtonLink>
            </div>
            <div className={styles.trust}>
              <span>FSSAI licensed</span>
              <span>Batch and dates on every jar</span>
              <span>Cash on delivery</span>
            </div>
            <Horizon className={styles.horizonLine} data-hero-horizon />
          </div>
        </div>

        <div className={`${styles.beat} ${styles.b1}`} data-beat="1">
          <p className="py-eyebrow">01 · The jar</p>
          <p className="py-display py-d-m">Open a jar of Sambhar.</p>
        </div>
        <div className={`${styles.beat} ${styles.b2}`} data-beat="2">
          <p className="py-eyebrow">02 · The salt</p>
          <p className="py-display py-d-m">Every crystal began as brine in an open pan.</p>
        </div>
        <div className={`${styles.beat} ${styles.b3}`} data-beat="3">
          <p className="py-eyebrow">03 · The lake</p>
          <p className="py-display py-d-xl">Two salts. One lake.</p>
          <p className="py-lead">
            India’s largest inland salt lake, in the heart of Rajasthan. This is where every jar
            begins.
          </p>
        </div>

        <div className={styles.rail} aria-hidden="true" data-rail>
          <span data-rail-text>01 / 03</span>
          <span className={styles.track}>
            <span className={styles.fill} data-rail-fill />
          </span>
        </div>
      </div>
    </section>
  );
}
