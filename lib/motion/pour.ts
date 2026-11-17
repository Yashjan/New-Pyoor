/**
 * The jar in the product film (lib/motion/film.ts): its pose as a pure function of the film's
 * progress f (0–1), so the 3D scene, the captions and the sound read the same timeline and
 * scrolling back reverses it exactly. No three.js: plain numbers, metres, the jar's base on y = 0.
 *
 *   .11–.22  shot 2: the cap unscrews, 2.5 turns, rising 11.25 mm along the thread
 *   .22–.28  it lifts off and glides to rest beside the jar (right, behind, 12°)
 *   .40–.55  shot 4: the jar rises and tips left about its base edge to 115° (2° anticipation)
 *   .62–.72  it rights itself and settles left of the mound
 * The salt's own motion (the free surface, the flow, every grain) is the pour simulation's
 * (lib/motion/pourSim.ts), computed from these curves in a worker.
 */
export const R = 0.05; // jar radius (10 cm across)
export const H = 0.122; // jar height with the cap
const deg = Math.PI / 180;
export const TILT = 115 * deg;
const ANTICIPATION = 2 * deg;
/** The jar's inside (from the model: tools/3d): salt radius, floor, the mouth's rim. */
export const INNER = { r: 0.047, floor: 0.003, rim: 0.118, rimR: 0.046, fill: 0.0992 } as const;
/** The rim's lowest point (tipping left) in the jar's frame from the pivot (the base's left edge). */
const LIP: readonly [number, number] = [R - INNER.rimR, INNER.rim];
/** How far the hand lifts the jar to pour, and moves it right while tipping it. */
const LIFT = 0.1;
const SHIFT = 0.0785;
/** The desktop jar's starting x (layout.jx × 0.558): the choreography is drawn around it. */
const X_DESKTOP = 0.13 * 0.558;

/** The film's pour window (shot 4). */
export const POUR = { start: 0.4, end: 0.75 } as const;

export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const span = (p: number, a: number, b: number) => clamp01((p - a) / (b - a));
const smooth = (a: number, b: number, x: number) => {
  const t = span(x, a, b);
  return t * t * (3 - 2 * t);
};
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/* ---------------- the jar ---------------- */

/** The jar's tilt (radians, + tips the top to the left) at f. */
export function tiltAt(p: number): number {
  const back = -ANTICIPATION * Math.sin(Math.PI * span(p, 0.4, 0.425));
  const u = span(p, 0.415, 0.55);
  // one weighted movement: slow to start, swinging through, settling softly
  const g = u * u * (3 - 2 * u);
  const right = 1 - smooth(0, 1, span(p, 0.62, 0.71)); // rights itself at the end
  return (TILT * g + back) * right;
}

/** Where the pour's mound stands (its centre x), for a jar that starts at x0. */
export const moundX = (x0: number) =>
  x0 - R + SHIFT - (LIP[0] * -Math.cos(TILT) + LIP[1] * Math.sin(TILT)) - 0.012;

/** The pivot (the base's left edge) at f: [x, y]. */
export function pivotAt(p: number, x0: number): [number, number] {
  const k = smooth(0.4, 0.55, p);
  const e = span(p, 0.62, 0.72);
  const xPour = x0 - R + SHIFT * k;
  const xEnd = moundX(x0) - 0.125 - R; // the jar settles left of the mound
  const x = xPour + (xEnd - xPour) * easeInOut(e);
  const y = LIFT * k * (1 - smooth(0.35, 1, e)); // down as soon as it has cleared the mound
  return [x, y];
}

/** The jar's centre on the ground once the pour is over (the dive's target). */
export const jarEndX = (x0: number) => pivotAt(1, x0)[0] + R;

const lip: [number, number] = [0, 0];
/** The rim's lowest point at f (the stream leaves around it): [x, y]. Returns a shared tuple. */
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
export const unscrewAt = (p: number) => easeInOut(span(p, 0.11, 0.22));
/** Off and away, 0–1 (eased). */
export const capAwayAt = (p: number) => smooth(0.22, 0.28, p);
/** Where the cap comes to rest: right of the jar, a little behind, leaning 12°. */
export const capRest = (x0: number): [number, number, number] => [
  x0 + 0.1,
  0.00875 + R * Math.sin(CAP_TILT) + 0.0002,
  -0.015, // just behind the horizon line, so it reads as resting on the ground
];
