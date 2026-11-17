/**
 * The jar sequence as a product film in six shots, one scrubbed progress f (0–1) over the
 * hero's pinned FILM_VH, after the Journey. Pure: the 3D scene, the captions, the progress line
 * and the sound all read it, and scrolling back reverses it exactly.
 *
 *   1  hold     .00–.10  the jar on the horizon, the headline (light follows the cursor)
 *   2  unscrew  .10–.28  macro on the cap: 2.5 turns up the thread, off, to rest beside the jar
 *   3  orbit    .28–.40  ~30° around the open jar, back to a medium shot; the label meets "02"
 *   4  pour     .40–.75  close on the lip, the stream, the mound (lib/motion/pourSim.ts)
 *   4b invite   .75–.82  the settled mound; "Add to bag" beside it
 *   5  dive     .82–1    down into the jar until its crystals fill the screen; the pink pans
 *                       (components/sections/SaltPans) engrave themselves over them
 *
 * The camera: keys of a subject (a point to look at, a box to frame, an orbit angle and an
 * elevation) eased with Hermite curves; each frame fits the box to the screen (fitCamera), so
 * one choreography serves every screen shape. f = 0 is exactly the frame the Journey and the
 * opening hand over to (heroCamera(0)).
 */
import { FOV, heroCamera, jarStartX, type HeroLayout } from './heroCamera';
import {
  CAP_C,
  CAP_RISE,
  H,
  INNER,
  R,
  capAwayAt,
  capRest,
  jarEndX,
  lipAt,
  moundX,
  unscrewAt,
} from './pour';

export const FILM_VH = 6;
export const SHOT = {
  hold: [0, 0.1],
  unscrew: [0.1, 0.28],
  orbit: [0.28, 0.4],
  pour: [0.4, 0.75],
  invite: [0.75, 0.82],
  dive: [0.82, 1],
} as const;
/** The progress line's chapter marks (01 / 02 / 03). */
export const CHAPTERS = [0, 0.28, 0.82] as const;

export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
export const span = (f: number, [a, b]: readonly [number, number]) => clamp01((f - a) / (b - a));
export const smooth = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

/** What the pour simulation tells the camera (null until it has run: estimates instead). */
export interface PourShape {
  onset: number;
  stop: number;
  moundH: number;
  /** the salt's level in the jar after the pour (jar frame, m) */
  levelEnd: number;
}
const ESTIMATE: PourShape = { onset: 0.453, stop: 0.661, moundH: 0.06, levelEnd: 0.032 };

type V3 = [number, number, number];
interface Key {
  f: number;
  look: V3;
  /** the box to frame (m), and the share of the screen's width / height it may take */
  w: number;
  h: number;
  fw: number;
  fh: number;
  /** orbit (around y, from the front) and elevation, radians */
  az: number;
  el: number;
}

const deg = Math.PI / 180;
const TAN = Math.tan((FOV * Math.PI) / 360);

/** The camera's distance that fits a w × h box (fractions fw, fh), on the tighter of the two. */
export function fitCamera(k: Pick<Key, 'w' | 'h' | 'fw' | 'fh'>, aspect: number): number {
  return Math.max(k.h / (k.fh * 2 * TAN), k.w / (k.fw * 2 * TAN * aspect));
}

/** The film's keys for this screen (x0: the jar's start; the pour as simulated). */
function keys(layout: HeroLayout, aspect: number, s: PourShape): Key[] {
  const list = rawKeys(layout, aspect, s);
  if (layout.portrait) return list;
  // desktop: the captions hold the left third, so the subject sits right of centre (all but
  // the dive's end, where the crystals fill the screen)
  for (const k of list) {
    // (wide shots only: a close-up stays on its subject)
    if (k.f <= 0.1 || k.f >= 0.95 || k.w < 0.15) continue;
    const d = fitCamera(k, aspect);
    k.look = [k.look[0] - 0.16 * 2 * TAN * d * aspect, k.look[1], k.look[2]];
  }
  return list;
}

function rawKeys(layout: HeroLayout, aspect: number, s: PourShape): Key[] {
  const x0 = jarStartX(layout);
  const portrait = layout.portrait;
  // desktop: the jar right of centre; phones: centred (above the text zone: viewShift)
  const right = (w: number, d: number) => (portrait ? 0 : -0.2 * 2 * TAN * d * aspect * w);
  const jarK = (f: number, extra: Partial<Key> = {}): Key => {
    const k: Key = {
      f,
      look: [x0, 0.062, 0],
      w: 0.1,
      h: H,
      fw: 0.58,
      fh: 0.42,
      az: 0,
      el: 9 * deg,
      ...extra,
    };
    const d = fitCamera(k, aspect);
    k.look = [x0 + right(1, d), k.look[1], 0];
    return k;
  };
  const cap = (f: number): V3 => [x0, CAP_C + unscrewAt(f) * CAP_RISE, 0];
  const rest = capRest(x0);
  const mid: V3 = [(x0 + rest[0]) / 2, 0.055, 0];
  const lip0: [number, number] = [...lipAt(s.onset, x0)]; // (a copy: lipAt returns a shared tuple)
  const mx = moundX(x0);
  const lipMid: [number, number] = [...lipAt((s.onset + s.stop) / 2, x0)];
  const xEnd = jarEndX(x0);
  const finalX = (xEnd - R + rest[0] + 0.06) / 2; // jar, mound and cap together
  return [
    jarK(0.1, { fh: 0.44 }),
    // shot 2: macro on the cap, a little from above; it fills ~45% of the frame
    { f: 0.15, look: cap(0.15), w: 0.104, h: 0.05, fw: 0.45, fh: 0.6, az: 6 * deg, el: 26 * deg },
    { f: 0.22, look: cap(0.22), w: 0.104, h: 0.05, fw: 0.47, fh: 0.6, az: 2 * deg, el: 24 * deg },
    // the cap away: back to the jar and its cap
    { f: 0.28, look: mid, w: 0.26, h: 0.14, fw: 0.66, fh: 0.5, az: 18 * deg, el: 12 * deg },
    // shot 3: the orbit, ~30° round, easing back to a medium shot
    {
      f: 0.4,
      look: [x0 + 0.02, 0.06, 0],
      w: 0.3,
      h: 0.16,
      fw: 0.62,
      fh: 0.46,
      az: -12 * deg,
      el: 8 * deg,
    },
    // shot 4: close on the lip as the first grains spill (they fill ~30% of the frame)
    {
      f: s.onset - 0.006,
      look: [lip0[0] - 0.004, lip0[1] - 0.006, 0],
      w: 0.06,
      h: 0.06,
      fw: 0.9,
      fh: 0.9,
      az: -14 * deg,
      el: 8 * deg,
    },
    {
      f: s.onset + 0.025,
      look: [lip0[0] - 0.012, lip0[1] - 0.025, 0],
      w: 0.09,
      h: 0.09,
      fw: 0.9,
      fh: 0.9,
      az: -10 * deg,
      el: 8 * deg,
    },
    // mid-pour: the stream and the growing mound
    {
      f: (s.onset + s.stop) / 2,
      look: [(lipMid[0] + mx) / 2, lipMid[1] * 0.5, 0],
      w: 0.3,
      h: Math.max(0.2, lipMid[1] + 0.03),
      fw: 0.8,
      fh: 0.82,
      az: -6 * deg,
      el: 9 * deg,
    },
    // the end: jar righted, cap resting, the mound centred on the horizon
    {
      f: 0.75,
      look: [finalX, 0.04, 0],
      w: rest[0] + 0.07 - (xEnd - R - 0.02),
      h: 0.16,
      fw: portrait ? 0.88 : 0.72,
      fh: 0.6,
      az: 0,
      el: 10 * deg,
    },
    {
      f: 0.82,
      look: [finalX, 0.04, 0],
      w: rest[0] + 0.07 - (xEnd - R - 0.02),
      h: 0.16,
      fw: portrait ? 0.86 : 0.7,
      fh: 0.58,
      az: 0,
      el: 12 * deg,
    },
    // shot 5: the dive, over the mouth and down into the jar, onto its crystals
    {
      f: 0.9,
      look: [xEnd, INNER.rim * 0.6, 0],
      w: 0.14,
      h: 0.14,
      fw: 0.8,
      fh: 0.8,
      az: 0,
      el: 58 * deg,
    },
    {
      f: 1,
      look: [xEnd - 0.004, s.levelEnd + 0.0006, 0.004],
      w: 0.016,
      h: 0.016,
      fw: 1,
      fh: 1,
      az: 0,
      el: 84 * deg,
    },
  ];
}

/** Hermite through a list of (f, value) with finite-difference tangents. */
function hermite(f: number, ks: Key[], get: (k: Key) => number): number {
  let i = 0;
  while (i < ks.length - 2 && f > ks[i + 1]!.f) i++;
  const k0 = ks[i]!;
  const k1 = ks[i + 1]!;
  const kp = ks[i - 1] ?? k0;
  const kn = ks[i + 2] ?? k1;
  const h = k1.f - k0.f;
  const t = clamp01((f - k0.f) / h);
  const t2 = t * t;
  const t3 = t2 * t;
  const a = get(k0);
  const b = get(k1);
  const m0 = i === 0 ? 0 : ((b - get(kp)) / (k1.f - kp.f)) * h;
  const m1 = i + 2 >= ks.length ? 0 : ((get(kn) - a) / (kn.f - k0.f)) * h;
  return (
    (2 * t3 - 3 * t2 + 1) * a + (t3 - 2 * t2 + t) * m0 + (-2 * t3 + 3 * t2) * b + (t3 - t2) * m1
  );
}

const pos: V3 = [0, 0, 0];
const look: V3 = [0, 0, 0];

/**
 * The film's camera at f: position, look-at (shared tuples) and the image's vertical shift
 * (phones: the subject centred in the 3D zone above the text, as camera.setViewOffset).
 */
export function filmCamera(
  f: number,
  layout: HeroLayout,
  aspect: number,
  shape: PourShape | null,
  glide = 1,
): { pos: V3; look: V3; shift: number } {
  const s = shape ?? ESTIMATE;
  const ks = keys(layout, aspect, s);
  const shiftMax = layout.portrait ? 0.17 : 0;
  if (f <= ks[0]!.f) {
    // the hold: from the hand-over frame (exactly the opening's) to the first key, eased
    const h0 = heroCamera(0, layout, glide);
    const k = ks[0]!;
    const d = fitCamera(k, aspect);
    const t = smooth(0, k.f, f);
    const to: V3 = [
      k.look[0] + d * Math.sin(k.az) * Math.cos(k.el),
      k.look[1] + d * Math.sin(k.el),
      k.look[2] + d * Math.cos(k.az) * Math.cos(k.el),
    ];
    for (let c = 0; c < 3; c++) {
      pos[c] = h0.pos[c]! + (to[c]! - h0.pos[c]!) * t;
      look[c] = h0.look[c]! + (k.look[c]! - h0.look[c]!) * t;
    }
    return { pos, look, shift: shiftMax * t };
  }
  const az = hermite(f, ks, (k) => k.az);
  const el = hermite(f, ks, (k) => k.el);
  // the distance in log space: a dolly reads as a steady push, at any scale
  const d = Math.exp(hermite(f, ks, (k) => Math.log(fitCamera(k, aspect))));
  for (let c = 0; c < 3; c++) look[c] = hermite(f, ks, (k) => k.look[c]!);
  pos[0] = look[0] + d * Math.sin(az) * Math.cos(el);
  pos[1] = look[1] + d * Math.sin(el);
  pos[2] = look[2] + d * Math.cos(az) * Math.cos(el);
  return { pos, look, shift: shiftMax };
}

/**
 * Projects a world point with the film camera at f to client px within a w × h canvas (the
 * DOM uses it: shot 3's chapter line meets the label's "HERBAL BLACK SALT").
 */
export function projectFilm(
  f: number,
  layout: HeroLayout,
  w: number,
  h: number,
  q: V3,
  shape: PourShape | null,
): [number, number] {
  const { pos: P, look: T, shift } = filmCamera(f, layout, w / h, shape);
  const fz = norm([T[0] - P[0], T[1] - P[1], T[2] - P[2]]);
  const right = norm([-fz[2], 0, fz[0]]);
  const up: V3 = [
    right[1] * fz[2] - right[2] * fz[1],
    right[2] * fz[0] - right[0] * fz[2],
    right[0] * fz[1] - right[1] * fz[0],
  ];
  const d: V3 = [q[0] - P[0], q[1] - P[1], q[2] - P[2]];
  const z = dot(d, fz);
  return [
    ((dot(d, right) / (z * TAN * (w / h)) + 1) / 2) * w,
    ((1 - dot(d, up) / (z * TAN)) / 2) * h - shift * h,
  ];
}
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (a: V3): V3 => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

/** Where the label's "HERBAL BLACK SALT" sits on the jar (jar frame: front, mid-label). */
export const LABEL_TITLE = { y: 0.066, z: R } as const;
export const capAwayDone = (f: number) => capAwayAt(f) >= 1;
