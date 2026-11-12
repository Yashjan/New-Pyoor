'use client';

import { useEffect, useId, useRef, type CSSProperties } from 'react';
import { reportLoad } from '@/lib/loader/progress';
import { expoOut } from '@/lib/motion/opening';
import { SAMBHAR } from './sambharGlyphs';
import {
  AFTER,
  COUNTER_START,
  DONE_AT,
  ENGRAVE,
  FAST,
  WINDOW,
  clockProgress,
  clockTime,
  letterStart,
  phase,
} from './timing';
import styles from './SambharOpening.module.css';

const [VX, VY, VW, VH] = SAMBHAR.viewBox;

/** The document timeline's time (the current frame's), or now. */
const frameTime = () => {
  const t = document.timeline?.currentTime;
  return typeof t === 'number' ? t : performance.now();
};

/** React dev mounts effects twice: the intro's clock survives the remount. */
let introClock: number | null = null;

/** Each contour's index in the word (the outer contour, then its counters), for --len. */
const FIRST = SAMBHAR.letters.reduce<number[]>(
  (acc, l, i) => [
    ...acc,
    (acc[i - 1] ?? 0) + (i ? 1 + SAMBHAR.letters[i - 1]!.counters.length : 0),
  ],
  [],
);
let pendingFinish = 0;

/**
 * Phones: SAMBHAR spans the width less 24px margins each side (clamped like the CSS); wider
 * screens: 78% of the width.
 */
const PHONE = 700;
const inkWidth = (w: number) => (w < PHONE ? Math.min(651, Math.max(200, w - 48)) : 0.78 * w);

/** The word's geometry as fractions of its width (the CSS lays it out from these). */
const GEO = {
  '--line-frac': ((SAMBHAR.line - VY) / VH).toFixed(5),
  '--aspect': `${VW} / ${VH}`,
  // the baseline and the cap line, measured from the seam, per unit of word width
  '--base-w': (-SAMBHAR.line / VW).toFixed(5),
  '--cap-w': ((SAMBHAR.cap + SAMBHAR.line) / VW).toFixed(5),
} as CSSProperties;

/**
 * Runs as the markup is parsed, before first paint: each hairline's length on screen (the strokes
 * are non-scaling, so their dashes are in screen pixels) and the seam (where the word splits, on a
 * whole pixel at half the height), so the CSS engraving can start at once, before any script.
 */
// The lengths go into a <style> in <head>, not onto the paths: React owns the paths' attributes,
// and changing them before hydration is a hydration mismatch. The engraving's start time is kept
// on window, so a remount (or a client re-render) continues on the same clock.
const PRE = `(function(r){window.__sambharT0=window.__sambharT0||performance.now();var k=function(){window.__sambharSkip=performance.now();['wheel','touchmove','keydown','pointerdown'].forEach(function(e){removeEventListener(e,k,true)})};['wheel','touchmove','keydown','pointerdown'].forEach(function(e){addEventListener(e,k,{capture:true,passive:true})});var w=innerWidth,s=(w<${PHONE}?Math.min(651,Math.max(200,w-48)):.78*w)/${VW},m=Math.round(r.clientHeight/2)+'px',c='',g=r.querySelector('svg');g&&g.querySelectorAll('[data-c]').forEach(function(p){c+='[data-opening] [data-c="'+p.getAttribute('data-c')+'"]{--len:'+(p.getTotalLength()*s).toFixed(2)+'}'});var e=document.getElementById('sambhar-len')||document.head.appendChild(document.createElement('style'));e.id='sambhar-len';e.textContent=c;r.style.setProperty('--seam',m)})(document.currentScript.parentNode)`;

/** The CSS engraving's timing for a contour drawn over [a, a + w] of the progress, on the clock. */
const timed = (a: number, w: number) => ({
  animationDelay: `${clockTime(a).toFixed(3)}s`,
  animationDuration: `${(clockTime(a + w) - clockTime(a)).toFixed(3)}s`,
});

/** One copy of the word: the ink (masked from the line outward), the hairlines and their tips. */
function Word() {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  return (
    <svg
      className={styles.word}
      data-word
      viewBox={`${VX} ${VY} ${VW} ${VH}`}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        {/* The ink's mask: a band centred on the seam, feathered 2px at both edges. */}
        <linearGradient
          id={`${id}g`}
          gradientUnits="userSpaceOnUse"
          x1="0"
          x2="0"
          y1={VY}
          y2={VY + VH}
          data-ink-band
        >
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="0" stopColor="#fff" stopOpacity="1" />
          <stop offset="1" stopColor="#fff" stopOpacity="1" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <mask
          id={`${id}m`}
          maskUnits="userSpaceOnUse"
          x={VX - 100}
          y={VY - 100}
          width={VW + 200}
          height={VH + 200}
        >
          <rect
            x={VX - 100}
            y={VY - 100}
            width={VW + 200}
            height={VH + 200}
            fill={`url(#${id}g)`}
          />
        </mask>
        {/* The pen's tip: a soft gold-300 head fading to transparent. */}
        <radialGradient id={`${id}t`}>
          <stop offset="0" stopColor="var(--gold-300)" stopOpacity="0.95" />
          <stop offset="0.45" stopColor="var(--gold-300)" stopOpacity="0.45" />
          <stop offset="1" stopColor="var(--gold-300)" stopOpacity="0" />
        </radialGradient>
      </defs>
      <g className={styles.ink} mask={`url(#${id}m)`} data-ink>
        {SAMBHAR.letters.map((l, i) => (
          <path key={i} d={l.outer + l.counters.join('')} fillRule="evenodd" />
        ))}
      </g>
      <g className={styles.strokes} data-strokes>
        {SAMBHAR.letters.map((l, i) => (
          <g key={i}>
            <path
              d={l.outer}
              data-contour={i}
              data-c={FIRST[i]}
              style={timed(letterStart(i), WINDOW)}
            />
            {l.counters.map((c, k) => (
              <path
                key={k}
                d={c}
                data-contour={i}
                data-c={FIRST[i]! + 1 + k}
                data-counter=""
                style={timed(letterStart(i) + COUNTER_START * WINDOW, (1 - COUNTER_START) * WINDOW)}
              />
            ))}
          </g>
        ))}
      </g>
      <g className={styles.tips} fill={`url(#${id}t)`} data-tips>
        {SAMBHAR.letters.flatMap((l, i) =>
          [l.outer, ...l.counters].map((_, k) => <circle key={`${i}-${k}`} r="0" />),
        )}
      </g>
    </svg>
  );
}

/**
 * "Sambhar is engraved": the homepage's opening. An overlay in the hero's pinned stage, above
 * the Journey panorama; it has no scroll code of its own.
 *
 *   The intro (this component): SAMBHAR engraves in gold hairlines (pure CSS, one 2.4 s pass),
 *   the navy ink spreads from the line, then the header, the small line and the scroll cue come
 *   in. Nothing holds the page: the first scroll input finishes the intro in ~0.3 s.
 *   The split (components/sections/Journey, the first phase of its one scrubbed timeline): two
 *   identical full-screen panels, each clipped to its half, part from a gold seam at the centre
 *   to show scene 01 behind them.
 *
 * Without JS, or with reduced motion, the CSS shows the filled word on one static screen.
 */
export function SambharOpening() {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    window.clearTimeout(pendingFinish);
    const root = rootRef.current;
    const html = document.documentElement;
    if (!root || !html.classList.contains('motion')) return;
    const all = (sel: string, from: ParentNode = root) => [
      ...from.querySelectorAll<HTMLElement>(sel),
    ];
    const hindis = all('[data-hindi]');
    const bodies = all('[data-body]');
    const cues = all('[data-cue]');
    const words = [...root.querySelectorAll<SVGSVGElement>('svg[data-word]')];
    const contours = words.map((w) =>
      [...w.querySelectorAll<SVGPathElement>('[data-contour]')].map((p) => ({
        el: p,
        len: p.getTotalLength(), // font units
      })),
    );
    const bands = words.map((w) => w.querySelector<SVGLinearGradientElement>('[data-ink-band]')!);
    const inks = words.map((w) => w.querySelector<SVGGElement>('[data-ink]')!);
    const strokes = words.map((w) => w.querySelector<SVGGElement>('[data-strokes]')!);

    // ---- geometry ----
    // Only the opening's own elements, and only when the width changes (a phone's address bar
    // changes the height alone: nothing is re-measured for it).
    let W = 0;
    let unit = 1; // CSS px per font unit
    const measure = () => {
      if (window.innerWidth === W) return;
      W = window.innerWidth;
      unit = inkWidth(W) / VW;
      // the hairlines are non-scaling: their dashes are measured on screen
      for (const cs of contours)
        for (const k of cs) k.el.style.setProperty('--len', (k.len * unit).toFixed(2));
      root.style.setProperty('--seam', `${Math.round(root.clientHeight / 2)}px`);
    };
    measure();

    // ---- A: the engraving and what follows it ----
    // The hairlines are pure CSS (one 2.4 s pass, from the server-rendered SVG): the script only
    // keeps time with them and never sets, resets or remounts a stroke.
    const setEngrave = (t: number) => {
      hindiIn = Math.min(1, clockProgress(t) * 1.4);
      for (const h of hindis) h.style.opacity = hindiIn.toFixed(3);
    };
    let hindiIn = 1;

    /** The ink band's half-height (font units) at fill f, feathered 2px at both edges. */
    const setFill = (f: number) => {
      const feather = 2 / unit;
      const reach = Math.max(SAMBHAR.line - VY, VY + VH - SAMBHAR.line) + feather;
      const h = f * reach;
      const span = 2 * (h + feather);
      const edge = feather / span;
      for (const band of bands) {
        band.setAttribute('y1', (SAMBHAR.line - h - feather).toFixed(2));
        band.setAttribute('y2', (SAMBHAR.line + h + feather).toFixed(2));
        const stops = band.querySelectorAll('stop');
        stops[1]!.setAttribute('offset', edge.toFixed(4));
        stops[2]!.setAttribute('offset', (1 - edge).toFixed(4));
      }
      for (const ink of inks) ink.style.opacity = f > 0 ? '1' : '0';
    };

    const setAfter = (s: number) => {
      setFill(expoOut(phase(s, AFTER.fill)));
      const outline = (1 - phase(s, AFTER.outline)).toFixed(3);
      for (const g of strokes) g.style.opacity = outline;
      // the header fades in by CSS (globals.css) once the attribute is set
      if (s >= AFTER.header[0] && !html.hasAttribute('data-header-in'))
        html.setAttribute('data-header-in', '');
      for (const b of bodies) b.style.opacity = phase(s, AFTER.body).toFixed(3);
      for (const c of cues) c.style.opacity = phase(s, AFTER.cue).toFixed(3);
    };

    const cleanups: (() => void)[] = [];
    let raf = 0;
    let introDone = html.dataset.intro !== 'full' || html.hasAttribute('data-intro-done');

    const finishIntro = () => {
      if (html.hasAttribute('data-intro-done')) return;
      setEngrave(Infinity);
      setAfter(DONE_AT);
      for (const el of [...bodies, ...cues]) el.style.removeProperty('opacity');
      html.setAttribute('data-header-in', '');
      html.setAttribute('data-engraved', '');
      html.setAttribute('data-intro-done', '');
      introDone = true;
    };

    // a remount after the intro: the word is already filled
    if (introDone && !html.hasAttribute('data-intro-done')) {
      html.setAttribute('data-header-in', '');
      html.setAttribute('data-intro-done', '');
    }

    if (!introDone) {
      // Take over the CSS engraving's clock (it has been running since first paint). The
      // pre-paint script noted when that was; failing that, the first hairline (S, no delay)
      // carries the CSS clock. A second mount keeps the first one's clock.
      const css = contours[0]?.[0]?.el.getAnimations()[0];
      const pre = (window as { __sambharT0?: number }).__sambharT0;
      const cssElapsed =
        introClock !== null
          ? (performance.now() - introClock) / 1000
          : css && typeof css.currentTime === 'number'
            ? // an animation's time is frozen at the last frame during a long task (hydration):
              // add the time since then, or the script would start behind what's on screen
              (css.currentTime + Math.max(0, performance.now() - frameTime())) / 1000
            : typeof pre === 'number'
              ? (performance.now() - pre) / 1000
              : 0;
      html.setAttribute('data-opening-js', '');
      introClock ??= performance.now() - cssElapsed * 1000;
      void document.fonts.ready.then(() => reportLoad('fonts', 1));
      void document.fonts
        .load(
          `20px ${getComputedStyle(html).getPropertyValue('--font-tiro').split(',')[0]}`,
          'सांभर',
        )
        .catch(() => {});
      // The pen runs on the clock alone and nothing holds the page: scrolling works from the
      // first paint. The first scroll input finishes the intro fast (FAST), it never waits.
      const FILL_END = ENGRAVE + AFTER.fill[1];
      let vt = cssElapsed; // the intro's own clock (seconds), sped up once interrupted
      let last = performance.now();
      let rate = 1;
      let fast = false;
      let engraved = false;
      const interrupt = () => {
        if (fast) return;
        fast = true;
        removeInputs();
        if (vt >= FILL_END) return;
        // the CSS hairlines: each one ends within FAST seconds (Web Animations API)
        for (const cs of contours)
          for (const c of cs)
            for (const a of c.el.getAnimations()) {
              const end = Number(a.effect?.getComputedTiming().endTime ?? 0);
              const left = end - Number(a.currentTime ?? end);
              if (left > 0) a.playbackRate = Math.max(1, left / (FAST * 1000));
            }
        rate = vt < ENGRAVE ? Math.max(1, (ENGRAVE - vt) / FAST) : 1;
      };
      const INPUTS = ['wheel', 'touchmove', 'keydown', 'scroll', 'pointerdown'] as const;
      const removeInputs = () =>
        INPUTS.forEach((e) => window.removeEventListener(e, interrupt, true));
      INPUTS.forEach((e) =>
        window.addEventListener(e, interrupt, { capture: true, passive: true }),
      );
      cleanups.push(removeInputs);
      // input before the script arrived (the pre-paint script noted it)
      if ((window as { __sambharSkip?: number }).__sambharSkip || window.scrollY > 8) interrupt();
      setEngrave(vt);
      setFill(0);
      const tick = (now: number) => {
        const dt = Math.min(0.1, (now - last) / 1000);
        last = now;
        vt += dt * rate;
        if (fast && vt >= ENGRAVE && rate > 1 && vt < FILL_END) rate = AFTER.fill[1] / FAST; // then the navy fill, as quickly
        if (vt >= FILL_END) rate = 1;
        if (!engraved) {
          setEngrave(vt);
          if (clockProgress(vt) >= 1) {
            engraved = true;
            html.setAttribute('data-engraved', ''); // heavier work may start now
          }
        }
        if (vt >= ENGRAVE) {
          const s = vt - ENGRAVE;
          setAfter(s);
          if (s >= DONE_AT) {
            finishIntro();
            return;
          }
        }
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }

    let resizeRaf = 0;
    const onResize = () => {
      if (!resizeRaf)
        resizeRaf = requestAnimationFrame(() => {
          resizeRaf = 0;
          measure();
        });
    };
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      cancelAnimationFrame(resizeRaf);
      cleanups.forEach((fn) => fn());
      // a remount (React dev) carries on; a real unmount finishes the intro
      if (!introDone) pendingFinish = window.setTimeout(finishIntro, 0);
    };
  }, []);

  return (
    <div ref={rootRef} className={styles.opening} style={GEO} data-opening suppressHydrationWarning>
      <span className="sr-only">Sambhar</span>
      <Panel side="l" />
      <Panel side="r" />
      {/* the seam: a gold hairline drawn down the centre as the split begins */}
      <div className={styles.seamBox} aria-hidden="true">
        <i className={styles.seamLine} data-seam-line />
      </div>
      <script dangerouslySetInnerHTML={{ __html: PRE }} />
    </div>
  );
}

/** One half of the screen: the whole opening, clipped to the left or the right half. */
function Panel({ side }: { side: 'l' | 'r' }) {
  return (
    <div className={styles.panel} data-panel={side} aria-hidden={side === 'r' || undefined}>
      <p className={styles.hindi} lang="hi" aria-hidden="true" data-hindi>
        सांभर
      </p>
      <div className={styles.box}>
        <Word />
      </div>
      <p className={`py-lead ${styles.body}`} data-body>
        Black salt and lake salt from India’s largest inland salt lake.
      </p>
      <div className={styles.cue} aria-hidden="true" data-cue>
        <span>Scroll</span>
        <i />
      </div>
    </div>
  );
}
