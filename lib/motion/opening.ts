/**
 * The homepage opening ("Sambhar is engraved"): the scroll range it takes at the top of the
 * hero, its scrubbed progress (shared by the DOM layers and the 3D jar), and its curves.
 *
 * Kept free of GSAP and three.js imports: both the opening and the jar scene read it.
 */

/** Scroll distance of the opening, in viewport heights, before the jar sequence starts. */
export const OPEN_VH = 1.2;

let progress = 0;

/** The opening's scrubbed progress, 0–1 (written by SambharOpening, read by the jar scene). */
export const openingStore = {
  get: () => progress,
  set: (o: number) => {
    progress = o;
  },
};

export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/** A CSS cubic-bezier(x1, y1, x2, y2) as a function of t (Newton steps, then bisection). */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number) {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  const sx = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sy = (t: number) => ((ay * t + by) * t + cy) * t;
  const dx = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
  return (x: number): number => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 6; i++) {
      const e = sx(t) - x;
      const d = dx(t);
      if (Math.abs(e) < 1e-6) return sy(t);
      if (Math.abs(d) < 1e-6) break;
      t -= e / d;
    }
    let lo = 0;
    let hi = 1;
    t = x;
    for (let i = 0; i < 30; i++) {
      const v = sx(t);
      if (Math.abs(v - x) < 1e-6) break;
      if (v < x) lo = t;
      else hi = t;
      t = (lo + hi) / 2;
    }
    return sy(t);
  };
}

/** The system curves (styles/tokens.css). */
export const easeSettle = cubicBezier(0.22, 1, 0.36, 1);
export const easeInOut = cubicBezier(0.65, 0, 0.35, 1);
/** expo.out, for the ink fill. */
export const expoOut = (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * clamp01(t)));

const span = (o: number, a: number, b: number) => clamp01((o - a) / (b - a));
const smoothSpan = (o: number, a: number, b: number) => {
  const t = span(o, a, b);
  return t * t * (3 - 2 * t);
};

export interface OpeningPose {
  /** The horizon opening (heavy: the system in-out curve). */
  open: number;
  /** The halves drifting out past the viewport edges. */
  drift: number;
  /** The jar's sunrise, from 30% below to centre (ease-settle). */
  rise: number;
  /** Desktop: the jar's glide from the centre to 62% of the width (ease-settle). */
  glide: number;
  /** gold-500 dawn glow opacity in the gap. */
  glow: number;
  /** The headline, CTA, trust row and Horizon. */
  copy: number;
  /** The small line under SAMBHAR and the scroll cue. */
  intro: number;
  /** सांभर, riding with the top half. */
  hindi: number;
  /** The gold line, riding under the top half. */
  line: number;
  /** The progress rail of the jar sequence. */
  rail: number;
}

/**
 * Everything the opening shows, as a pure function of its progress o (0–1 over OPEN_VH):
 *   .00–.06  the small line and the cue leave
 *   .00–.40  the horizon opens: SAMBHAR splits along the gold line
 *   .10–.55  the jar rises out of the gap as it opens (the approved stills: one sunrise)
 *   .40–.72  the halves drift out, the top half under the header, the bottom past the edge
 *   .70–1    the jar glides to 62% (desktop) as the headline and CTA fade in
 */
export function openingPose(o: number): OpeningPose {
  const open = easeInOut(span(o, 0, 0.4));
  return {
    open,
    drift: easeInOut(span(o, 0.4, 0.72)),
    rise: easeSettle(span(o, 0.1, 0.55)),
    glide: easeSettle(span(o, 0.7, 1)),
    glow: 0.08 * smoothSpan(o, 0.04, 0.4) + 0.03 * smoothSpan(o, 0.4, 0.7),
    copy: smoothSpan(o, 0.74, 0.96),
    intro: 1 - span(o, 0, 0.06),
    hindi: 1 - clamp01(open / 0.5),
    line: 1 - clamp01(open / 0.7),
    rail: smoothSpan(o, 0.88, 1),
  };
}
