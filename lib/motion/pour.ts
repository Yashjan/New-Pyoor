/**
 * The jar sequence ("the pour"): one pinned, scrubbed scene after the Journey. Everything here
 * is a pure function of the sequence progress p (0–1) and the jar's starting x, so the 3D scene,
 * the captions and the sound read the same timeline, and scrolling back reverses it exactly.
 * No three.js: plain numbers, metres, the jar's base at y = 0.
 *
 *   0–.15    the cap unscrews: 2.5 turns, rising 11.25 mm along the thread
 *   .15–.25  it lifts ~1.2 jar heights and glides to rest beside the jar (right, behind, 12°)
 *   .22–.40  the jar rises and tips left about its base edge to 115° (a 2° anticipation first)
 *   POUR     the stream starts as the tilt passes 35° and runs to .85, thin, full, thin
 *   .33–.9   the grains build a cone on the horizon line (35°, the angle of repose)
 *   .85–.97  the jar rights itself and settles left of the mound; then a short hold
 */
export const R = 0.05; // jar radius (10 cm across)
export const H = 0.122; // jar height with the cap
const deg = Math.PI / 180;
export const TILT = 115 * deg;
const ANTICIPATION = 2 * deg;
/** The lowest point of the lip, from the pivot (the base's left edge) in the jar's frame. */
const LIP: readonly [number, number] = [0.004, H - 0.016];
/** How far the hand lifts the jar to pour, and moves it right while tipping it. */
const LIFT = 0.1;
const SHIFT = 0.0785;
/** The desktop jar's starting x (layout.jx × 0.558): the choreography is drawn around it. */
const X_DESKTOP = 0.13 * 0.558;

export const POUR_END = 0.85;
/** Mound: 35° cone, 4.2 cm tall (6 cm radius) when the pour is done. */
export const REPOSE = Math.tan(35 * deg);
export const MOUND_H = 0.042;
/** Sequence progress a grain spends in the air. */
export const FLIGHT = 0.016;

export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const span = (p: number, a: number, b: number) => clamp01((p - a) / (b - a));
const smooth = (a: number, b: number, x: number) => {
  const t = span(x, a, b);
  return t * t * (3 - 2 * t);
};
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/* ---------------- the jar ---------------- */

/** The jar's tilt (radians, + tips the top to the left) at p. */
export function tiltAt(p: number): number {
  const back = -ANTICIPATION * Math.sin(Math.PI * span(p, 0.22, 0.27));
  const u = span(p, 0.245, 0.4);
  // one weighted movement: slow to start, swinging through, settling softly
  const g = u * u * (3 - 2 * u);
  const right = 1 - smooth(0, 0.6, span(p, POUR_END, 0.97)); // rights itself at the end
  return (TILT * g + back) * right;
}

/** Where the pour's mound stands (its centre x), for a jar that starts at x0. */
export const moundX = (x0: number) =>
  x0 - R + SHIFT - (LIP[0] * -Math.cos(TILT) + LIP[1] * Math.sin(TILT)) - 0.003;

/** The pivot (the base's left edge) at p: [x, y]. */
export function pivotAt(p: number, x0: number): [number, number] {
  const k = smooth(0.22, 0.4, p);
  const e = span(p, POUR_END, 0.97);
  const xPour = x0 - R + SHIFT * k;
  const xEnd = moundX(x0) - 0.125 - R; // the jar settles left of the mound
  const x = xPour + (xEnd - xPour) * easeInOut(e);
  const y = LIFT * k * (1 - smooth(0.35, 1, e)); // down as soon as it has cleared the mound
  return [x, y];
}

const lip: [number, number] = [0, 0];
/** The lip's lowest point at p (the stream leaves from here): [x, y]. Returns a shared tuple. */
export function lipAt(p: number, x0: number): [number, number] {
  const [px, py] = pivotAt(p, x0);
  const a = tiltAt(p);
  const c = Math.cos(a);
  const s = Math.sin(a);
  lip[0] = px + LIP[0] * c - LIP[1] * s;
  lip[1] = py + LIP[0] * s + LIP[1] * c;
  return lip;
}

/** Where the choreography sits relative to the desktop layout (phones: the jar starts centred). */
export const offsetFor = (x0: number) => x0 - X_DESKTOP;

/* ---------------- the cap ---------------- */

/** The cap's centre in the jar's frame (Lid + Lid_rim: 10.45–12.2 cm). */
export const CAP_C = 0.1133;
export const CAP_TURNS = 2.5;
export const CAP_RISE = 0.01125; // 2.5 turns × 4.5 mm pitch
export const CAP_TILT = 12 * deg;
/** Unscrewing, 0–1 (eased). */
export const unscrewAt = (p: number) => easeInOut(span(p, 0, 0.15));
/** Off and away, 0–1 (eased). */
export const capAwayAt = (p: number) => smooth(0.15, 0.25, p);
/** Where the cap comes to rest: right of the jar, a little behind, leaning 12°. */
export const capRest = (x0: number): [number, number, number] => [
  x0 + 0.1,
  0.00875 + R * Math.sin(CAP_TILT) + 0.0002,
  -0.015, // just behind the horizon line, so it reads as resting on the ground
];

/* ---------------- the pour ---------------- */

/** The moment the tilt passes 35°: the stream starts there, no gap. */
export const POUR_START = (() => {
  let a = 0.22;
  let b = 0.4;
  for (let i = 0; i < 40; i++) {
    const m = (a + b) / 2;
    if (tiltAt(m) < 35 * deg) a = m;
    else b = m;
  }
  return b;
})();

/** Pour rate shape, 0–1 at p: thin at first, fuller in the middle, thinning at the end. */
export function pourRate(p: number): number {
  if (p <= POUR_START || p >= POUR_END) return 0;
  return Math.pow(Math.sin(Math.PI * span(p, POUR_START, POUR_END)), 0.7);
}

/** Cumulative share of the salt poured by p (0–1), from a precomputed table. */
const CDF = (() => {
  const n = 1024;
  const t = new Float64Array(n + 1);
  let sum = 0;
  for (let i = 1; i <= n; i++) {
    const p = POUR_START + ((POUR_END - POUR_START) * (i - 0.5)) / n;
    sum += pourRate(p);
    t[i] = sum;
  }
  for (let i = 1; i <= n; i++) t[i]! /= sum;
  return t;
})();

export function pouredAt(p: number): number {
  const x = span(p, POUR_START, POUR_END) * (CDF.length - 1);
  const i = Math.min(CDF.length - 2, Math.floor(x));
  return CDF[i]! + (CDF[i + 1]! - CDF[i]!) * (x - i);
}

/** When the share u (0–1) of the salt leaves the lip. */
export function emitAt(u: number): number {
  let lo = 0;
  let hi = CDF.length - 1;
  while (hi - lo > 1) {
    const m = (lo + hi) >> 1;
    if (CDF[m]! < u) lo = m;
    else hi = m;
  }
  const f = (u - CDF[lo]!) / Math.max(1e-9, CDF[hi]! - CDF[lo]!);
  return POUR_START + ((POUR_END - POUR_START) * (lo + f)) / (CDF.length - 1);
}

/** The mound's height at p (its volume follows what has landed; the angle stays 35°). */
export const moundHeightAt = (p: number) => MOUND_H * Math.cbrt(pouredAt(p - FLIGHT));
