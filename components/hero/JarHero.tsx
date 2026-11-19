'use client';

import Image from 'next/image';
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { ButtonLink } from '@/components/Button/Button';
import { SambharOpening } from '@/components/opening/SambharOpening';
import { Journey } from '@/components/sections/Journey/Journey';
import { LabelReader } from '@/components/LabelReader/LabelReader';
import { SEQUENCE_START_VH } from '@/lib/motion/opening';
import { PANS_VH, openVh, pansProgress } from '@/lib/motion/pans';
import { PANORAMA } from '@/components/sections/Journey/panorama';
import { Invite, type InviteProps } from './Invite';
import { SaltPans } from '@/components/sections/SaltPans/SaltPans';
import { modelUrl } from '@/lib/three/models';
import { pickQualityTier } from '@/lib/three/quality';
import styles from './JarHero.module.css';
import { asset } from '@/lib/basePath';

const MODEL_URL = modelUrl('pyoor-herbal-black-salt.glb');
/** "Drag to turn" is shown until the first turn, then not again this session. */
const TURNED = 'pyoor-jar-turned';
const turnedBefore = () => {
  try {
    return window.sessionStorage.getItem(TURNED) === '1';
  } catch {
    return false;
  }
};

/**
 * The jar sequence's progress 0–1: how far the pinned section has been scrolled through after
 * the Journey panorama and the opening (the first SEQUENCE_START_VH viewport heights), up to
 * step 3, the salt pans (the last PANS_VH).
 */
function heroProgress(section: HTMLElement): number {
  const rect = section.getBoundingClientRect();
  const open = window.innerHeight * SEQUENCE_START_VH;
  const range = rect.height - window.innerHeight * (1 + PANS_VH + openVh()) - open;
  return range > 0 ? Math.min(1, Math.max(0, (-rect.top - open) / range)) : 0;
}

/** Left alone, the 3D jar starts building this long after navigation (ms): after the intro and
 * a quiet stretch, so the first screens stay light. A gesture starts it sooner. */
const QUIET_START_MS = 5200;

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
export function JarHero({
  fromPrice,
  invite,
  lake,
}: {
  fromPrice: string | null;
  /** Shot 4b: the jar to add to the bag beside the settled mound. */
  invite: InviteProps | null;
  /** The pin's last layer: the products' opening (Products/LakeOpening), behind the pans. */
  lake?: ReactNode;
}) {
  const sectionRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [posterGone, setPosterGone] = useState(false);
  // the "Drag to turn" hint: shown with the first 3D frame, gone after the first turn
  const [hint, setHint] = useState(false);

  // Reduced motion: no camera, no pour, no dive: the key frames crossfade (0.6 s) as the
  // captions come into view: the closed jar, the open jar (beat 1), the final mound (beat 2).
  useEffect(() => {
    const section = sectionRef.current;
    if (!section || document.documentElement.classList.contains('motion')) return;
    const steps: [string, string][] = [
      ['[data-beat="1"]', styles.opened!],
      ['[data-beat="2"]', styles.poured!],
    ];
    const ios = steps.map(([sel, cls]) => {
      const beat = section.querySelector(sel);
      const io = new IntersectionObserver(([e]) => {
        if (!e?.isIntersecting) return;
        section.classList.add(cls);
        io.disconnect();
      });
      if (beat) io.observe(beat);
      return io;
    });
    return () => ios.forEach((io) => io.disconnect());
  }, []);

  useEffect(() => {
    const section = sectionRef.current;
    const canvas = canvasRef.current;
    if (!section || !canvas) return;
    const tier = document.documentElement.classList.contains('motion') ? pickQualityTier() : null;
    if (!tier) {
      section.toggleAttribute('data-no3d', true); // no 3D on this device: the poster stays
      return;
    }

    const controller = new AbortController();
    let dispose: (() => void) | undefined;

    // Built in idle time right after first paint, independent of the intro (nothing waits for
    // it, and it waits for nothing): createJarScene works in idle chunks, and the canvas stays
    // hidden until step 2's reveal, where the engraving stands in if it isn't ready yet.
    let urgent = false;
    const start = async () => {
      if (controller.signal.aborted) return;
      const { createJarScene } = await import('./scene/createJarScene');
      if (controller.signal.aborted) return;
      try {
        const scene = await createJarScene({
          canvas,
          tier,
          modelUrl: MODEL_URL,
          linkWait: urgent ? 0 : 250,
          getProgress: () => heroProgress(section),
          getPans: () => pansProgress(section),
          onFirstFrame: () => {
            setPosterGone(true);
            setHint(!turnedBefore());
          },
          onFirstTurn: () => {
            setHint(false);
            try {
              window.sessionStorage.setItem(TURNED, '1');
            } catch {
              // private mode: the hint just won't be remembered
            }
          },
          signal: controller.signal,
        });
        if (controller.signal.aborted) scene.dispose();
        else dispose = scene.dispose;
      } catch (err) {
        if ((err as Error).name !== 'AbortError') console.error('Jar hero failed to start', err);
      }
    };
    // Not during the intro: compiling the jar's shaders blocks the main thread (seconds on a
    // phone), so the loader and SAMBHAR stay light. It starts on the visitor's first gesture
    // (scrolling starts the film, which is long enough to build it under the engraving) or,
    // left alone, once the page has been quiet for a while after the intro.
    const GESTURES = ['wheel', 'touchstart', 'keydown', 'pointerdown', 'scroll'] as const;
    let begun = false;
    let idle = 0;
    const go = (e?: Event) => {
      if (begun) return;
      urgent = !!e || window.scrollY > 0; // a gesture: the visitor is on the way
      begun = true;
      GESTURES.forEach((g) => window.removeEventListener(g, go));
      window.clearTimeout(timer);
      if (window.requestIdleCallback)
        idle = window.requestIdleCallback(() => void start(), { timeout: 600 });
      else idle = window.setTimeout(() => void start(), 50);
    };
    GESTURES.forEach((g) => window.addEventListener(g, go, { passive: true, once: true }));
    const timer = window.setTimeout(() => go(), Math.max(0, QUIET_START_MS - performance.now()));
    if (window.scrollY > 0) go();

    return () => {
      controller.abort();
      GESTURES.forEach((g) => window.removeEventListener(g, go));
      window.clearTimeout(timer);
      if (window.cancelIdleCallback) window.cancelIdleCallback(idle);
      window.clearTimeout(idle);
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
        {/* shot 1: the jar stands in Sambhar: the Journey's far pans and mounds, very faint,
            their horizon on the jar's (the film fades it: HomeMotion) */}
        <div className={styles.backdrop} aria-hidden="true" data-backdrop>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={asset('/engravings/journey-far.svg')}
            alt=""
            loading="lazy"
            decoding="async"
            style={{
              transform: `translateX(-${((100 * PANORAMA.layers.far.centers[1]!) / PANORAMA.layers.far.width).toFixed(3)}%)`,
            }}
          />
        </div>
        <div className={styles.jarLayer} data-jar-layer>
          <div className={styles.jarMask} data-jar-mask>
            <div className={styles.jarBack} data-jar-back>
              {/* focusable once shown (at rest: ←/→ turn the jar; scene/turn.ts) */}
              <canvas
                ref={canvasRef}
                className={styles.gl}
                tabIndex={0}
                role="img"
                aria-label="Pyoor Herbal Black Salt jar in 3D. Drag, or use the left and right arrow keys, to turn it."
              />
              <Image
                className={`${styles.poster} ${posterGone ? styles.gone : ''}`}
                src={asset('/images/renders/jar-black.webp')}
                alt="Pyoor Herbal Black Salt jar"
                width={1206}
                height={1570}
                sizes="(max-width: 860px) 56vw, min(30vw, 380px)"
                fetchPriority="low"
              />
              {/* reduced motion: the closed jar crossfades to the open one, then to the pour's
                  end (jar, cap, mound) */}
              <Image
                className={styles.posterOpen}
                src={asset('/images/renders/jar-open.webp')}
                alt=""
                width={1800}
                height={1100}
                sizes="(max-width: 860px) 90vw, 50vw"
                loading="lazy"
              />
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

        {/* shot 1's editorial type (the outer block is faded by the film, the inner one by the
            opening); the headline's words rise from their masks at the hand-over */}
        <div className={styles.copy} data-hero-copy>
          <div className={styles.copyIn} data-copy-in>
            <p className={styles.chapter}>01 · The jar</p>
            <h1 className={`py-display ${styles.h1}`}>
              {'Salt, the way the lake makes it.'.split(' ').map((w, i) => (
                <span key={i}>
                  <span className={styles.wm}>
                    <span className={styles.w} style={{ '--i': i } as CSSProperties}>
                      {w}
                    </span>
                  </span>{' '}
                </span>
              ))}
            </h1>
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
        </div>

        {/* keyboard focus on the jar: a ring around the jar itself (the canvas fills the stage) */}
        <span className={styles.jarRing} aria-hidden="true" data-jar-ring />

        {/* under the jar, until the first turn (faded with the headline by the jar sequence) */}
        <p
          className={`${styles.turnHint} ${hint ? styles.turnHintOn : ''}`}
          aria-hidden="true"
          data-turn-hint
        >
          Drag to turn
          <svg viewBox="0 0 24 8" width="24" height="8" fill="none" stroke="currentColor">
            <path d="M1 4h22M4 1 1 4l3 3M20 1l3 3-3 3" strokeWidth="1" />
          </svg>
        </p>

        {/* beside the jar: the label reader (faded with the headline by the jar sequence) */}
        <LabelReader />

        {/* the film's captions and its progress line: faded as a whole when step 3 begins
            (HomeMotion); phones: in the text zone at the bottom */}
        <div className={styles.beats} data-beats>
          <div className={`${styles.beat} ${styles.b1}`} data-beat="1">
            <p className={styles.chapter}>01 · The jar</p>
            <p className={`py-display ${styles.cap}`}>Open a jar of Sambhar.</p>
          </div>
          {/* shot 3: the chapter line meets the label's "HERBAL BLACK SALT" (HomeMotion
              places it: --label-y); shot 4: the line comes in as the stream starts */}
          <div className={`${styles.beat} ${styles.b2}`} data-beat="2">
            <p className={styles.chapter} data-beat-chapter>
              02 · The salt
            </p>
            <p className={`py-display ${styles.cap}`} data-beat-line>
              Every crystal began as brine in an open pan.
            </p>
          </div>
          <div className={`${styles.beat} ${styles.b3}`} data-beat="3">
            <p className={styles.chapter}>03 · The lake</p>
            <p className={`py-display ${styles.cap}`}>Two salts. One lake.</p>
            <p className="py-lead">
              India’s largest inland salt lake, in the heart of Rajasthan. This is where every jar
              begins.
            </p>
          </div>

          {/* shot 4b: beside the settled mound (phones: below it) */}
          {invite && <Invite {...invite} />}

          {/* the film's progress: a thin gold line at the right edge, chapters 01 / 02 / 03 */}
          <div className={styles.rail} aria-hidden="true" data-rail>
            <span className={styles.track}>
              <span className={styles.fill} data-rail-fill />
            </span>
            {['01', '02', '03'].map((c, i) => (
              <span
                key={c}
                className={styles.mark}
                style={{ '--at': [0, 0.28, 0.82][i] } as CSSProperties}
                data-rail-mark={i}
              >
                {c}
              </span>
            ))}
          </div>
        </div>

        {/* step 4 opens behind the pans ("the lake opens": Products/LakeMotion) */}
        {lake}
        {/* step 3: the pink salt pans (PANS_VH), then the split along their seam */}
        <SaltPans />
        <span className={styles.seam} aria-hidden="true" data-lake-seam />
      </div>
    </section>
  );
}
