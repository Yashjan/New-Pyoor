'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { ButtonLink } from '@/components/Button/Button';
import { SplitText } from '@/components/SplitText/SplitText';
import { modelUrl } from '@/lib/three/models';
import { pickQualityTier } from '@/lib/three/quality';
import styles from './JarHero.module.css';

const MODEL_URL = modelUrl('pyoor-herbal-black-salt.glb');

/** Hero scroll progress 0–1: how far the pinned 520vh section has been scrolled through. */
function heroProgress(section: HTMLElement): number {
  const rect = section.getBoundingClientRect();
  const range = rect.height - window.innerHeight;
  return range > 0 ? Math.min(1, Math.max(0, -rect.top / range)) : 0;
}

/**
 * The signature moment (concept.html): the jar floats, the cap unscrews and flies off, the jar
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

  useEffect(() => {
    const section = sectionRef.current;
    const canvas = canvasRef.current;
    if (!section || !canvas) return;
    if (!document.documentElement.classList.contains('motion')) return;
    const tier = pickQualityTier();
    if (!tier) return;

    const controller = new AbortController();
    let dispose: (() => void) | undefined;

    // Start after the page has painted and gone idle, so the text and buttons come first.
    const start = async () => {
      const { createJarScene } = await import('./scene/createJarScene');
      if (controller.signal.aborted) return;
      try {
        const scene = await createJarScene({
          canvas,
          tier,
          modelUrl: MODEL_URL,
          getProgress: () => heroProgress(section),
          onFirstFrame: () => setPosterGone(true),
          signal: controller.signal,
        });
        if (controller.signal.aborted) scene.dispose();
        else dispose = scene.dispose;
      } catch (err) {
        if ((err as Error).name !== 'AbortError') console.error('Jar hero failed to start', err);
      }
    };
    const idle = window.requestIdleCallback
      ? window.requestIdleCallback(() => void start(), { timeout: 1200 })
      : window.setTimeout(() => void start(), 200);

    return () => {
      controller.abort();
      if (window.cancelIdleCallback) window.cancelIdleCallback(idle);
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
      <div className={styles.stage}>
        <canvas ref={canvasRef} className={styles.gl} aria-hidden="true" />
        <Image
          className={`${styles.poster} ${posterGone ? styles.gone : ''}`}
          src="/images/renders/jar-black.webp"
          alt="Pyoor Herbal Black Salt jar"
          width={1206}
          height={1570}
          sizes="(max-width: 860px) 56vw, min(30vw, 380px)"
          fetchPriority="high"
          loading="eager"
        />

        <div className={styles.copy} data-hero-copy>
          <p className="py-eyebrow">Sambhar Lake · Rajasthan</p>
          <SplitText as="h1" className={`py-display py-d-xl ${styles.h1}`}>
            Salt, the way the lake makes it.
          </SplitText>
          <p className="py-lead">
            Black salt and lake salt, harvested and crafted on the shores of India’s largest inland
            salt lake.
          </p>
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
          <p className="py-display py-d-xl">Sambhar Lake</p>
          <p className="py-lead">
            India’s largest inland salt lake, in the heart of Rajasthan. This is where every jar
            begins.
          </p>
        </div>

        <div className={styles.rail} aria-hidden="true">
          <span data-rail-text>01 / 03</span>
          <span className={styles.track}>
            <span className={styles.fill} data-rail-fill />
          </span>
        </div>
        <div className={styles.cue} aria-hidden="true" data-hero-cue>
          Scroll
          <i />
        </div>
      </div>
    </section>
  );
}
