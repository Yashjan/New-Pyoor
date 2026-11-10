'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { loadProgress, onLoadProgress, partProgress, reportLoad } from '@/lib/loader/progress';
import { loadGsap } from '@/lib/motion/gsap';
import { lenisStore } from '@/lib/motion/lenis';
import { createDawn, type DawnState } from './dawn';
import styles from './CrystalDawn.module.css';

// ---- timing (seconds) ----
const A_END = 0.6; // seed: the horizon draws, the point of light appears
const B_MIN = 1.2; // growth takes at least this long, driven by real load progress
const C_DUR = 0.45; // light catches
const FORCE_AT = 2.2; // s after first paint: still loading → go on to C/D/E (cap ≈ 4.5 s in all)
const SKIP_AFTER = 1; // from here a click, tap or key jumps to the release
const LOGO_IN = 0.2; // from the release: once the crystal has gone, the logo rises in where it was
const LOGO_GLIDE = 0.55; // … then glides into its header slot
const GLIDE_DUR = 0.55;
const OPEN_AT = LOGO_GLIDE + 0.25; // the horizon opens 0.25 s after the glide begins
const OPEN_DUR = 1.1;
const JAR_IN_AT = 0.5; // opening fraction after which the jar is fully uncovered
const GATE_MAX = 0.6; // wait at most this long for three.js before the story starts
const STORAGE_KEY = 'pyoor-intro';

const clamp = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const smooth = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const expoOut = (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));
const expoInOut = (t: number) =>
  t <= 0
    ? 0
    : t >= 1
      ? 1
      : t < 0.5
        ? Math.pow(2, 20 * t - 10) / 2
        : (2 - Math.pow(2, -20 * t + 10)) / 2;
const settle = (t: number) => 1 - Math.pow(1 - clamp(t), 3); // ≈ ease-settle, no overshoot

/**
 * "Crystal Dawn", the homepage's first-visit intro (see README). `html[data-intro]` is set
 * before first paint in app/layout.tsx:
 *   full     first visit this session (or ?intro=always): the whole story, ending in the reveal
 *   reduced  first visit with reduced motion: the finished crystal and logo, held, then a fade
 *   fade     later visits: a 0.3 s fade of an ivory screen (CSS only)
 *   unset    no JS, or another page: nothing
 * The page is server-rendered underneath; this overlay is decorative (aria-hidden) and
 * <main> is aria-busy until the reveal.
 */
export function CrystalDawn() {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hiRef = useRef<HTMLParagraphElement>(null);
  const enRef = useRef<HTMLParagraphElement>(null);
  const logoRef = useRef<HTMLDivElement>(null);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    const html = document.documentElement;
    const main = document.getElementById('main');
    const mode = html.dataset.intro;
    if ((mode !== 'full' && mode !== 'reduced') || html.hasAttribute('data-intro-done')) {
      main?.removeAttribute('aria-busy');
      return;
    }
    const root = rootRef.current!,
      canvas = canvasRef.current!,
      logo = logoRef.current!;
    const hi = hiRef.current!,
      en = enRef.current!;
    root.dataset.running = ''; // JS is in charge: switch off the CSS failsafe

    let raf = 0;
    let cancelled = false;
    const cleanups: (() => void)[] = [];
    const remember = () => {
      try {
        sessionStorage.setItem(STORAGE_KEY, '1');
      } catch {
        // storage blocked: the next visit plays the intro again, which is harmless
      }
    };
    const finish = () => {
      if (html.hasAttribute('data-intro-done')) return;
      remember();
      for (const a of [
        'data-intro-play',
        'data-jar-in',
        'data-header-in',
        'data-horizon-in',
        'data-intro-done',
      ])
        html.setAttribute(a, '');
      main?.removeAttribute('aria-busy');
      lenisStore.get()?.start();
      setGone(true); // unmounts the overlay: the canvas goes with it
    };

    let dawn: ReturnType<typeof createDawn> | null = null;
    try {
      dawn = createDawn(canvas);
      dawn.resize(window.innerWidth, window.innerHeight, window.devicePixelRatio);
    } catch {
      dawn = null; // no canvas: the reduced version (logo only)
    }
    const logoImg = logo.querySelector('img')!;
    const logoH = window.innerWidth < 700 ? 52 : 72;
    logoImg.style.height = `${logoH}px`;

    // ---- reduced motion (or no canvas): the finished crystal and logo, held, then a fade ----
    if (mode === 'reduced' || !dawn) {
      const st: DawnState = {
        t: 1.8,
        horizon: 1,
        seed: 0,
        grow: 1,
        sun: 1,
        glint: -1,
        release: -1,
        fade: 0,
        absorb: 0,
        open: 0,
        line: null,
      };
      dawn?.render(st);
      const lay = dawn?.layout();
      const w = (logoH * 629) / 264;
      logo.style.transform = `translate(${window.innerWidth / 2 - w / 2}px, ${lay ? lay.hy + 28 : window.innerHeight / 2 - logoH / 2}px)`;
      logo.style.opacity = '1';
      const t = window.setTimeout(() => {
        const anim = root.animate([{ opacity: 1 }, { opacity: 0 }], {
          duration: 300,
          fill: 'forwards',
        });
        anim.onfinish = finish;
      }, 600);
      return () => {
        window.clearTimeout(t);
        dawn?.dispose();
        if (!cancelled) finish();
      };
    }

    // ---- the full intro ----
    void document.fonts.ready.then(() => reportLoad('fonts', 1));
    void document.fonts
      .load(`20px ${getComputedStyle(html).getPropertyValue('--font-tiro').split(',')[0]}`, 'सांभर')
      .catch(() => {});
    void loadGsap().then(
      () => reportLoad('gsap', 1),
      () => reportLoad('gsap', 1),
    );
    let target = loadProgress();
    cleanups.push(onLoadProgress((p) => (target = p)));

    // skip: after 1 s, any click, tap or key jumps to the release
    let skip = false;
    const onSkip = () => {
      if (performance.now() - t0 >= SKIP_AFTER * 1000) skip = true;
    };
    window.addEventListener('pointerdown', onSkip, { passive: true });
    window.addEventListener('keydown', onSkip);
    cleanups.push(() => {
      window.removeEventListener('pointerdown', onSkip);
      window.removeEventListener('keydown', onSkip);
    });

    const onResize = () =>
      dawn!.resize(window.innerWidth, window.innerHeight, window.devicePixelRatio);
    window.addEventListener('resize', onResize);
    cleanups.push(() => window.removeEventListener('resize', onResize));

    const st: DawnState = {
      t: 0,
      horizon: 0,
      seed: 0,
      grow: 0,
      sun: 0,
      glint: -1,
      release: -1,
      fade: 0,
      absorb: 0,
      open: 0,
      line: null,
    };
    const line = { x: 0, y: 0, w: 0 };
    let x = 0,
      v = 0; // progress, smoothed by a critically damped spring
    let grow = 0,
      growAtC = 0;
    let tC = -1;
    let last = 0;
    let opened = false,
      jarIn = false,
      headerIn = false;
    let slot: DOMRect | null = null,
      hz: DOMRect | null = null;
    let lastHi = -1,
      lastEn = -1;
    let lastPhase = '';
    const t0 = performance.now();
    // the visitor first sees the dawn at the first paint: phase A and the 4.5 s cap count from there
    const paintAt = Math.min(
      t0,
      performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? t0,
    );
    let t = 0;
    let begun = false;

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      // The story runs on its own clock, advancing at most 1/30 s per frame: if the page stalls
      // (the hero's 3D setup), the drawing pauses instead of jumping. The cap runs on real time.
      const real = (now - t0) / 1000;
      // Begin once three.js has been parsed (its one long task falls on the still-blank first
      // paint, not mid-animation), or after GATE_MAX regardless.
      if (!begun) {
        if (partProgress('three') < 1 && real < GATE_MAX) return;
        begun = true;
        last = real;
        // carry on from the CSS phase A (it started at the first paint)
        t = Math.min(A_END, Math.max(0, (now - paintAt) / 1000));
        root.dataset.canvas = ''; // hides the CSS horizon and seed: the canvas draws them now
      }
      const dt = Math.min(1 / 30, real - last || 1 / 60);
      last = real;
      t += dt;
      const lay = dawn!.layout();

      // B: progress → growth, through a critically damped spring (ω = 7), at least 1.2 s long
      const w = 7;
      v += (w * w * (target - x) - 2 * w * v) * dt;
      x = Math.min(1, x + v * dt);
      if (tC < 0) {
        grow = Math.max(grow, Math.min(x, clamp((t - A_END) / B_MIN)));
        if ((grow >= 0.999 && t >= A_END + B_MIN) || (now - paintAt) / 1000 >= FORCE_AT) {
          tC = t;
          growAtC = grow;
        } else if (skip) {
          tC = t - C_DUR; // straight to the release
          growAtC = grow;
        }
      }
      if (tC >= 0) grow = growAtC + (1 - growAtC) * expoOut(clamp((t - tC) / 0.3));
      const tD = tC >= 0 ? tC + C_DUR : Infinity;
      const d = t - tD; // seconds since the release

      st.t = t;
      st.horizon = clamp(t / A_END);
      st.seed = expoOut(clamp((t - 0.15) / 0.45));
      st.grow = grow;
      st.sun = tC >= 0 ? Math.max(grow, smooth(0, 0.4, t - tC)) : grow;
      st.glint = tC >= 0 && d < 0 ? 0.5 - Math.cos(Math.PI * clamp((t - tC) / C_DUR)) / 2 : -1;
      st.release = d >= 0 ? d : -1;
      st.fade = d >= 0 ? smooth(0, 0.22, d / 0.9) : 0; // gone before the logo arrives
      st.absorb = d >= 0 ? smooth(0.25, 0.7, d / 0.9) * (1 - smooth(1, 1.8, d)) : 0;

      // text: सांभर at ~30%, then Sambhar Lake · Rajasthan at ~70%; both leave with the grains
      const leave = d >= 0 ? 1 - smooth(0, 0.35, d) : 1;
      const hiA =
        Math.round(smooth(0.25, 0.35, grow) * (1 - smooth(0.65, 0.75, grow)) * leave * 100) / 100;
      const enA = Math.round(smooth(0.65, 0.75, grow) * leave * 100) / 100;
      if (hiA !== lastHi) hi.style.opacity = String((lastHi = hiA));
      if (enA !== lastEn) en.style.opacity = String((lastEn = enA));

      // E: the logo rises in where the crystal was, then glides into the header slot
      if (d >= LOGO_IN) {
        slot ??=
          document.querySelector<HTMLElement>('[data-header-logo] img')?.getBoundingClientRect() ??
          null;
        const lw = (logoH * 629) / 264;
        const x0 = lay.cx + lay.L * 0.12 - lw / 2,
          y0 = lay.cy - logoH / 2 + lay.L * 0.1;
        const inK = settle((d - LOGO_IN) / 0.3);
        const g = expoInOut(clamp((d - LOGO_GLIDE) / GLIDE_DUR));
        const tx = slot ? slot.left : x0,
          ty = slot ? slot.top : 16,
          sc = slot ? slot.height / logoH : 0.5;
        logo.style.opacity = headerIn ? '0' : String(inK);
        logo.style.transform = `translate(${x0 + (tx - x0) * g}px, ${y0 + 12 * (1 - inK) + (ty - y0) * g}px) scale(${1 + (sc - 1) * g})`;
        if (!headerIn && g >= 1) {
          headerIn = true; // the header's own logo takes over; its nav and bag fade in (0.4 s)
          html.setAttribute('data-header-in', '');
          logo.style.opacity = '0';
        }
      }

      // E: the horizon opens; the seam rides the opening edge and settles on the hero's Horizon
      const open = d >= OPEN_AT ? expoInOut(clamp((d - OPEN_AT) / OPEN_DUR)) : 0;
      if (open > 0 && !opened) {
        opened = true;
        root.dataset.open = ''; // drop the overlay's own ground: the page shows through
        html.setAttribute('data-intro-play', ''); // the hero intro starts as the opening begins
        hz =
          document.querySelector<HTMLElement>('[data-hero-horizon]')?.getBoundingClientRect() ??
          null;
      }
      st.open = open;
      if (open > 0) {
        const ty = hz ? hz.top + 0.5 : lay.hy;
        const up = open * (lay.hy + 60),
          down = open * (lay.H - lay.hy + 60);
        line.y = ty >= lay.hy ? Math.min(lay.hy + down, ty) : Math.max(lay.hy - up, ty);
        const k = smooth(0.25, 0.6, open);
        line.x = (hz ? hz.left : 0) * k;
        line.w = lay.W + ((hz ? hz.width : lay.W) - lay.W) * k;
        st.line = line;
        if (!jarIn && open >= JAR_IN_AT) {
          jarIn = true;
          html.setAttribute('data-jar-in', '');
        }
      }
      // phase marker (read by the recording/FPS scripts; set only on change)
      const phase = open > 0 ? 'E' : d >= 0 ? 'D' : tC >= 0 ? 'C' : t >= A_END ? 'B' : 'A';
      if (phase !== lastPhase) root.dataset.phase = lastPhase = phase;
      dawn!.render(st);

      if (open >= 1) {
        cancelAnimationFrame(raf);
        finish();
      }
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      cleanups.forEach((c) => c());
      dawn?.dispose();
      finish(); // leaving mid-intro (client navigation): never strand the page behind it
    };
  }, []);

  if (gone) return null;
  return (
    <div ref={rootRef} className={styles.root} aria-hidden="true" data-dawn>
      {/* Phase A in plain CSS, so the story starts with the first paint, before any JS */}
      <i className={styles.hz} />
      <i className={styles.seed} />
      <canvas ref={canvasRef} className={styles.canvas} />
      <p ref={hiRef} className={styles.hi} lang="hi">
        सांभर
      </p>
      <p ref={enRef} className={styles.en}>
        Sambhar Lake · Rajasthan
      </p>
      <div ref={logoRef} className={styles.logo}>
        <Image
          src="/brand/pyoor-logo.png"
          alt=""
          width={629}
          height={264}
          sizes="180px"
          loading="eager"
        />
      </div>
    </div>
  );
}
