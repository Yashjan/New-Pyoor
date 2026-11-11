'use client';

import { useEffect, useId, useRef, type CSSProperties } from 'react';
import { loadProgress, onLoadProgress, reportLoad } from '@/lib/loader/progress';
import { loadGsap } from '@/lib/motion/gsap';
import { lenisStore } from '@/lib/motion/lenis';
import {
  OPEN_START_VH,
  OPEN_VH,
  clamp01,
  expoOut,
  openingPose,
  openingStore,
} from '@/lib/motion/opening';
import { SAMBHAR } from './sambharGlyphs';
import {
  AFTER,
  COUNTER_START,
  DONE_AT,
  HOLD_MAX,
  UNLOCK_AT,
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
const PRE = `(function(r){window.__sambharT0=window.__sambharT0||performance.now();var w=innerWidth,s=(w<${PHONE}?Math.min(651,Math.max(200,w-48)):.78*w)/${VW},m=Math.round(r.clientHeight/2)+'px',c='',g=r.querySelector('svg');g&&g.querySelectorAll('[data-c]').forEach(function(p){c+='[data-opening] [data-c="'+p.getAttribute('data-c')+'"]{--len:'+(p.getTotalLength()*s).toFixed(2)+'}'});var e=document.getElementById('sambhar-len')||document.head.appendChild(document.createElement('style'));e.id='sambhar-len';e.textContent=c;r.style.setProperty('--seam',m);r.parentNode.style.setProperty('--seam',m)})(document.currentScript.parentNode)`;

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
 * "Sambhar is engraved": the homepage's opening, inside the hero's pinned stage.
 *
 *   A  SAMBHAR engraves in gold hairlines, letter by letter, in one 2.4 s pass; if the page
 *      isn't ready yet, the word holds, shimmering, for up to 4 s. Then the navy ink spreads from the
 *      seam, the outline fades, and the header, the small line and the scroll cue come in.
 *   B  Scrolling opens the horizon: the word splits along the seam, the halves part and drift
 *      out (the top half under the header), the gap glowing faintly gold.
 *   C  The jar rises out of the gap (components/hero/scene reads the same progress), then
 *      glides to 62% as the headline and CTA fade in.
 *
 * html[data-intro="full"] (app/layout.tsx) plays A on every load, refreshes included.
 * Without JS, or with reduced motion, the CSS shows the filled word at once, fades only. The
 * engraving starts in CSS before any script arrives; this component takes over its clock.
 */
export function SambharOpening() {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    window.clearTimeout(pendingFinish);
    const root = rootRef.current;
    const html = document.documentElement;
    if (!root || !html.classList.contains('motion')) return;
    const stage = root.parentElement!;
    const hero = stage.closest<HTMLElement>('[data-hero]')!;
    const $ = <T extends Element = HTMLElement>(sel: string, from: ParentNode = root) =>
      from.querySelector<T>(sel)!;
    // the halves move as transforms only; their clips are static (SambharOpening.module.css)
    const top = $('[data-half="top"] > div');
    const bottom = $('[data-half="bottom"] > div');
    const hindi = $('[data-hindi]');
    const body = $('[data-body]');
    const cue = $('[data-cue]');
    const glow = $('[data-opening-glow]', stage);
    const jarMask = $('[data-jar-mask]', stage);
    const jarBack = $('[data-jar-back]', stage);
    const poster = $('[data-jar-layer] img', stage);
    const copyIn = $('[data-copy-in]', stage);
    const rail = stage.querySelector<HTMLElement>('[data-rail]');
    const header = document.querySelector<HTMLElement>('[data-site-header]');
    const words = [...root.querySelectorAll<SVGSVGElement>('svg')];
    const contours = words.map((w) =>
      [...w.querySelectorAll<SVGPathElement>('[data-contour]')].map((p) => {
        const letter = Number(p.dataset.contour);
        const counter = p.hasAttribute('data-counter');
        // the same start and end times as the CSS engraving (timed()), linear in between, so
        // the script takes over exactly where the CSS has drawn to
        const from = letterStart(letter) + (counter ? COUNTER_START * WINDOW : 0);
        return {
          el: p,
          letter,
          len: p.getTotalLength(), // font units
          t0: clockTime(from),
          t1: clockTime(letterStart(letter) + WINDOW),
          floor: 0, // how far it has been drawn (on screen, by the CSS or the script)
        };
      }),
    );
    const tips = words.map((w) => [...w.querySelectorAll<SVGCircleElement>('[data-tips] circle')]);
    const bands = words.map((w) => w.querySelector<SVGLinearGradientElement>('[data-ink-band]')!);
    const inks = words.map((w) => w.querySelector<SVGGElement>('[data-ink]')!);
    const strokes = words.map((w) => w.querySelector<SVGGElement>('[data-strokes]')!);
    const headerKids = header ? [...(header.children as HTMLCollectionOf<HTMLElement>)] : [];

    // ---- geometry ----
    let W = 0;
    let H = 0;
    let seam = 0;
    let unit = 1; // CSS px per font unit
    let hb = 0;
    const measure = () => {
      W = window.innerWidth;
      H = stage.clientHeight;
      seam = Math.round(H / 2);
      unit = inkWidth(W) / VW;
      hb = header?.getBoundingClientRect().bottom ?? 0;
      // the hairlines are non-scaling: their dashes are measured on screen
      for (const cs of contours)
        for (const k of cs) k.el.style.setProperty('--len', (k.len * unit).toFixed(2));
      root.style.setProperty('--seam', `${seam}px`);
      root.style.setProperty('--hb', `${hb}px`);
      stage.style.setProperty('--seam', `${seam}px`);
    };
    measure();

    // ---- A: the engraving and what follows it ----
    /** The pen at t seconds into the engraving (Infinity: finished). */
    const setEngrave = (t: number) => {
      for (let w = 0; w < words.length; w++) {
        const cs = contours[w]!;
        for (let c = 0; c < cs.length; c++) {
          const k = cs[c]!;
          const a = Math.max(k.floor, clamp01((t - k.t0) / (k.t1 - k.t0)));
          k.floor = a; // a hairline only ever grows
          k.el.style.strokeDashoffset = (k.len * unit * (1 - a)).toFixed(2);
          k.el.style.opacity = a > 0 ? '1' : '0'; // no round-cap dot before a contour starts
          // The tip: a soft gold head on the pen, fading as the letter completes.
          const tip = tips[w]![c]!;
          const fade =
            a <= 0 || a >= 1 ? 0 : Math.min(1, a / 0.04) * (1 - clamp01((a - 0.8) / 0.2));
          tip.style.opacity = fade.toFixed(3);
          if (fade > 0) {
            const pt = k.el.getPointAtLength(k.len * a);
            tip.setAttribute('cx', pt.x.toFixed(1));
            tip.setAttribute('cy', pt.y.toFixed(1));
            tip.setAttribute('r', (3.5 / unit).toFixed(2));
          }
        }
      }
      hindiIn = Math.min(1, clockProgress(t) * 1.4);
      hindi.style.opacity = (hindiIn * hindiOpen).toFixed(3);
    };
    let hindiIn = 1;
    let hindiOpen = 1;

    /** A very soft gold shimmer travelling along the finished word, opacity only. */
    const setShimmer = (time: number, amp: number) => {
      const w = ((time / 1.8) % 1) * 1.5 - 0.25; // the bright crest, left to right
      for (const cs of contours)
        for (const k of cs) {
          const u = (k.letter + 0.5) / SAMBHAR.letters.length;
          const crest = Math.exp(-(((u - w) / 0.14) ** 2));
          k.el.style.opacity = (1 - amp * 0.2 * (1 - crest)).toFixed(3);
        }
    };

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
      const hd = easeOutSettle(phase(s, AFTER.header)).toFixed(3);
      for (const k of headerKids) k.style.opacity = hd;
      body.style.opacity = phase(s, AFTER.body).toFixed(3);
      cue.style.opacity = phase(s, AFTER.cue).toFixed(3);
    };
    const easeOutSettle = (t: number) => 1 - Math.pow(1 - t, 3);

    const cleanups: (() => void)[] = [];
    let raf = 0;
    let introDone = html.dataset.intro !== 'full' || html.hasAttribute('data-intro-done');

    const finishIntro = () => {
      if (html.hasAttribute('data-intro-done')) return;
      setEngrave(Infinity);
      setAfter(DONE_AT);
      for (const k of headerKids) k.style.removeProperty('opacity');
      body.style.removeProperty('opacity');
      cue.style.removeProperty('opacity');
      html.setAttribute('data-header-in', '');
      html.setAttribute('data-engraved', '');
      html.setAttribute('data-intro-done', '');
      html.style.removeProperty('overflow');
      lenisStore.get()?.start();
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
      // whatever the CSS has already drawn stays drawn
      for (const cs of contours)
        for (const k of cs) {
          const st = getComputedStyle(k.el);
          const L = k.len * unit;
          k.floor = st.opacity === '0' || !L ? 0 : clamp01(1 - parseFloat(st.strokeDashoffset) / L);
        }
      html.setAttribute('data-opening-js', '');
      const t0 = (introClock ??= performance.now() - cssElapsed * 1000);
      void document.fonts.ready.then(() => reportLoad('fonts', 1));
      void document.fonts
        .load(
          `20px ${getComputedStyle(html).getPropertyValue('--font-tiro').split(',')[0]}`,
          'सांभर',
        )
        .catch(() => {});
      // The pen runs on the clock alone; load progress only decides when the loader ends.
      let ready = loadProgress() >= 1;
      cleanups.push(onLoadProgress((p) => (ready ||= p >= 1)));
      let engravedAt = -1;
      let afterAt = -1;
      let shimmerFrom = 0;
      let unlocked = false;
      // Arrived already scrolled (restored position): no intro, the filled word.
      if (window.scrollY > 8) finishIntro();
      else {
        html.style.overflow = 'hidden'; // held until the outline has faded (Lenis is stopped too)
        setEngrave(cssElapsed);
        setFill(0);
        const tick = (now: number) => {
          const t = (now - t0) / 1000;
          if (engravedAt < 0) {
            setEngrave(t);
            if (clockProgress(t) >= 1) {
              engravedAt = t;
              html.setAttribute('data-engraved', ''); // heavier work may start now
            }
          } else if (afterAt < 0) {
            // the finished word, held until the page is ready (at most HOLD_MAX)
            const hold = t - engravedAt;
            setShimmer(hold, Math.min(1, hold / 0.3));
            if (ready || hold >= HOLD_MAX) {
              afterAt = t;
              shimmerFrom = Math.min(1, hold / 0.3);
            }
          } else {
            const fade = Math.max(0, 1 - (t - afterAt) / 0.3);
            if (shimmerFrom > 0) {
              setShimmer(t - engravedAt, shimmerFrom * fade);
              if (fade === 0) shimmerFrom = 0;
            }
            const s = t - afterAt;
            setAfter(s);
            if (!unlocked && s >= UNLOCK_AT) {
              unlocked = true;
              html.style.removeProperty('overflow');
              lenisStore.get()?.start();
            }
            if (s >= DONE_AT) {
              finishIntro();
              return;
            }
          }
          raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      }
    }

    // ---- B and C: the scrubbed opening ----
    const render = (o: number) => {
      openingStore.set(o);
      const P = openingPose(o);
      const up = P.open * 0.27 * H + P.drift * 0.36 * H;
      const down = 0.9 * up; // the bottom half moves 10% less
      // (the top half is clipped under the header: it never crosses the nav or the logo)
      top.style.transform = `translate3d(0,${(-up).toFixed(2)}px,0)`;
      bottom.style.transform = `translate3d(0,${down.toFixed(2)}px,0)`;
      hindiOpen = P.hindi;
      hindi.style.opacity = (hindiIn * hindiOpen).toFixed(3);
      if (introDone) {
        body.style.opacity = P.intro.toFixed(3);
        cue.style.opacity = P.intro.toFixed(3);
      }
      glow.style.opacity = P.glow.toFixed(3);
      // The jar is hidden below the gap's bottom edge, feathered 16px: it rises out of the
      // opening like a sunrise, not out of a slot. The mask is static; it moves down with the
      // bottom half and the jar is moved back up inside it (transforms only, no repaint).
      jarMask.style.transform = `translate3d(0,${down.toFixed(2)}px,0)`;
      jarBack.style.transform = `translate3d(0,${(-down).toFixed(2)}px,0)`;
      jarMask.classList.toggle(styles.unmasked!, P.drift >= 1);
      // the poster (until the 3D jar's first frame) follows the same rise, tilt and glide
      const dx = W < PHONE ? 0 : P.glide * 0.12 * W;
      poster.style.translate = `${dx.toFixed(1)}px ${((1 - P.rise) * 0.3 * H).toFixed(1)}px`;
      poster.style.rotate = `${(2.5 * (1 - P.rise)).toFixed(3)}deg`;
      copyIn.style.opacity = P.copy.toFixed(3);
      copyIn.style.transform = `translate3d(0,${(14 * (1 - P.copy)).toFixed(2)}px,0)`;
      // still focusable while hidden: :focus-within shows it (SambharOpening.module.css)
      copyIn.style.pointerEvents = P.copy > 0.5 ? '' : 'none';
      if (rail) rail.style.opacity = P.rail.toFixed(3);
    };
    render(0);

    let cancelled = false;
    let kill: (() => void) | undefined;
    let current = 0;
    void loadGsap().then(({ gsap, ScrollTrigger }) => {
      reportLoad('gsap', 1);
      if (cancelled) return;
      const state = { o: 0 };
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: hero,
          // behind the Journey panorama, which uncovers it three-quarters done
          start: () => `top+=${Math.round(window.innerHeight * OPEN_START_VH)} top`,
          end: () => `+=${Math.round(window.innerHeight * OPEN_VH)}`,
          scrub: 0.9,
          invalidateOnRefresh: true,
        },
        onUpdate: () => {
          current = tl.progress();
          render(current);
        },
      });
      tl.to(state, { o: 1, ease: 'none', duration: 1 });
      kill = () => {
        tl.scrollTrigger?.kill();
        tl.kill();
      };
      ScrollTrigger.refresh();
    });

    const onResize = () => {
      measure();
      render(current);
    };
    window.addEventListener('resize', onResize);

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      cleanups.forEach((fn) => fn());
      kill?.();
      // a remount (React dev) carries on; a real unmount finishes the intro
      if (!introDone) pendingFinish = window.setTimeout(finishIntro, 0);
    };
  }, []);

  return (
    <div ref={rootRef} className={styles.opening} style={GEO} data-opening suppressHydrationWarning>
      <span className="sr-only">Sambhar</span>
      <div className={styles.half} data-half="top">
        <div className={styles.halfIn}>
          <p className={styles.hindi} lang="hi" aria-hidden="true" data-hindi>
            सांभर
          </p>
          <div className={styles.box}>
            <Word />
          </div>
        </div>
      </div>
      <div className={styles.half} data-half="bottom" aria-hidden="true">
        <div className={styles.halfIn}>
          <div className={styles.box}>
            <Word />
          </div>
        </div>
      </div>
      <p className={`py-lead ${styles.body}`} data-body>
        Black salt and lake salt from India’s largest inland salt lake.
      </p>
      <div className={styles.cue} aria-hidden="true" data-cue>
        Scroll
        <i />
      </div>
      <script dangerouslySetInnerHTML={{ __html: PRE }} />
    </div>
  );
}
