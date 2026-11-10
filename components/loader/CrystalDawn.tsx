'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { lenisStore } from '@/lib/motion/lenis';
import { createDawn, type DawnState } from './dawn';
import styles from './CrystalDawn.module.css';

// ---- timing (story seconds; --dawn-scale in the CSS maps them to real time) ----
// A 0.6 + B 1.2 + C 0.45 + E opening at 0.8 + 1.1 = 4.15 story-seconds, played in 4.5 s.
const A_END = 0.6; // seed: the horizon draws, the point of light appears
const B_DUR = 1.2; // growth (fixed: the intro never waits for loading)
const C_DUR = 0.45; // light catches
const T_C = A_END + B_DUR;
const LOGO_IN = 0.2; // from the release: once the crystal has gone, the logo rises in where it was
const LOGO_GLIDE = 0.55; // … then glides into its header slot
const GLIDE_DUR = 0.55;
const OPEN_AT = LOGO_GLIDE + 0.25; // the horizon opens 0.25 s after the glide begins
const OPEN_DUR = 1.1;
const JAR_IN_AT = 0.5; // opening fraction after which the jar is fully uncovered

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

/** A cleanup's finish, deferred a tick: React's dev double-mount cancels it by mounting again. */
let pendingFinish = 0;

/**
 * "Crystal Dawn", the homepage's first-visit intro (see README). `html[data-intro]` is set
 * before first paint in app/layout.tsx:
 *   full     every load of the homepage (for now): the whole story, ending in the reveal
 *   reduced  with reduced motion: the finished crystal and logo, held, then a fade
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
    window.clearTimeout(pendingFinish); // a remount (React dev): carry on, don't finish
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
    // story-seconds → real seconds (CrystalDawn.module.css --dawn-scale: the whole intro in 4.5 s)
    const scale = Number(getComputedStyle(root).getPropertyValue('--dawn-scale')) || 1;

    let raf = 0;
    const cleanups: (() => void)[] = [];
    const finish = () => {
      if (html.hasAttribute('data-intro-done')) return;
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
        pendingFinish = window.setTimeout(finish, 0);
      };
    }

    // ---- the full intro: a fixed 4.5 s, whether or not the page has finished loading ----
    void document.fonts
      .load(`20px ${getComputedStyle(html).getPropertyValue('--font-tiro').split(',')[0]}`, 'सांभर')
      .catch(() => {});

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
    let opened = false,
      jarIn = false,
      headerIn = false;
    let slot: DOMRect | null = null,
      hz: DOMRect | null = null;
    let lastHi = -1,
      lastEn = -1;
    let lastPhase = '';
    // The dawn is on screen from the first paint (phase A is CSS): pick up where the CSS is, then
    // run on real time. If the script came late, the whole story still plays from there.
    const t0 = performance.now();
    const paintAt = Math.min(
      t0,
      performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? t0,
    );
    const tStart = Math.min(A_END, Math.max(0, (t0 - paintAt) / 1000 / scale));
    root.dataset.canvas = ''; // hides the CSS horizon and seed: the canvas draws them now

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const t = tStart + Math.max(0, now - t0) / 1000 / scale;
      const lay = dawn!.layout();

      // B: the crystal grows over a fixed 1.2 story-seconds; then C, D and E follow on time
      const grow = clamp((t - A_END) / B_DUR);
      const tC = t >= T_C ? T_C : -1;
      const tD = T_C + C_DUR;
      const d = t - tD; // seconds since the release

      st.t = t;
      st.horizon = clamp(t / A_END);
      st.seed = expoOut(clamp((t - 0.15) / 0.45));
      st.grow = grow;
      st.sun = grow;
      st.glint = tC >= 0 && d < 0 ? 0.5 - Math.cos(Math.PI * clamp((t - tC) / C_DUR)) / 2 : -1;
      st.release = d >= 0 ? d : -1;
      st.fade = d >= 0 ? smooth(0, 0.22, d / 0.9) : 0; // gone before the logo arrives
      st.absorb = d >= 0 ? smooth(0.25, 0.7, d / 0.9) * (1 - smooth(1, 1.8, d)) : 0;

      // text: Sambhar Lake · Rajasthan at ~30%, then सांभर at ~70%; both leave with the grains
      const leave = d >= 0 ? 1 - smooth(0, 0.35, d) : 1;
      const enA =
        Math.round(smooth(0.25, 0.35, grow) * (1 - smooth(0.65, 0.75, grow)) * leave * 100) / 100;
      const hiA = Math.round(smooth(0.65, 0.75, grow) * leave * 100) / 100;
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
      cancelAnimationFrame(raf);
      cleanups.forEach((c) => c());
      dawn?.dispose();
      // leaving mid-intro (client navigation): never strand the page behind it
      pendingFinish = window.setTimeout(finish, 0);
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
