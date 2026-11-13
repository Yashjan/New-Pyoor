/**
 * The hero camera as a pure function of the jar sequence's progress (no three.js), so the 3D
 * scene and the Journey's step 2 (which lines its engraving up on the 3D jar at p = 0) use the
 * very same camera. Metres; the jar is 12.2 cm tall; vertical fov 24° (FOV).
 */
import { offsetFor } from './pour';

/**
 * A product-photography lens: 24° (was 30°), the camera moved back by tan(15°)/tan(12°) along
 * its view so the jar keeps the same size in frame, with flatter, less distorted perspective.
 */
export const FOV = 24;
const LENS = Math.tan((15 * Math.PI) / 180) / Math.tan((FOV * Math.PI) / 360);

export interface HeroLayout {
  /** Jar x offset in metres: right of the headline on desktop, centred on phones. */
  jx: number;
  portrait: boolean;
}

export function layoutFor(width: number, height: number): HeroLayout {
  const portrait = width / height < 0.9;
  return { portrait, jx: portrait ? 0 : 0.13 };
}

/** The jar's starting x (after the opening's glide, 0–1). */
export const jarStartX = (layout: HeroLayout, glide = 1) => layout.jx * 0.558 * glide;

type V3 = [number, number, number];
interface Key {
  p: number;
  pos: V3;
  look: V3;
}

/**
 * Desktop keyframes (x relative to the desktop layout). p = 0 is the frame the opening and the
 * Journey hand over to (the jar beside the headline); then a push towards the cap, out as it
 * lands, a dolly in and down towards the mound during the pour, and the final frame centred on
 * the mound with the jar and the cap either side.
 */
const K: readonly Key[] = [
  { p: 0, pos: [0, 0.1, 0.62], look: [0, 0.07, 0] }, // x follows the jar (below)
  { p: 0.12, pos: [0.03, 0.11, 0.58], look: [0.05, 0.09, 0] },
  { p: 0.19, pos: [0.05, 0.14, 0.64], look: [0.07, 0.115, 0] }, // the cap's lift, in frame
  { p: 0.27, pos: [0.05, 0.11, 0.66], look: [0.05, 0.075, 0] },
  { p: 0.4, pos: [0.03, 0.11, 0.68], look: [0.02, 0.065, 0] },
  { p: 0.6, pos: [0.015, 0.1, 0.62], look: [0.005, 0.058, 0] }, // dolly in, a little lower
  { p: 0.85, pos: [0.005, 0.1, 0.63], look: [0, 0.06, 0] },
  { p: 0.97, pos: [0, 0.11, 0.66], look: [-0.01, 0.075, 0] },
  { p: 1, pos: [0, 0.11, 0.66], look: [-0.01, 0.075, 0] },
];

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smooth = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

/** Cubic Hermite through the keys with finite-difference tangents: no stops between keys. */
function track(p: number, get: (k: Key) => V3, out: V3): V3 {
  let i = 0;
  while (i < K.length - 2 && p > K[i + 1]!.p) i++;
  const k0 = K[i]!;
  const k1 = K[i + 1]!;
  const kp = K[i - 1] ?? k0;
  const kn = K[i + 2] ?? k1;
  const h = k1.p - k0.p;
  const t = clamp01((p - k0.p) / h);
  const t2 = t * t;
  const t3 = t2 * t;
  const a = get(k0);
  const b = get(k1);
  const ap = get(kp);
  const bn = get(kn);
  for (let c = 0; c < 3; c++) {
    const m0 = i === 0 ? 0 : ((b[c]! - ap[c]!) / (k1.p - kp.p)) * h;
    const m1 = i + 2 >= K.length ? 0 : ((bn[c]! - a[c]!) / (kn.p - k0.p)) * h;
    out[c] =
      (2 * t3 - 3 * t2 + 1) * a[c]! +
      (t3 - 2 * t2 + t) * m0 +
      (-2 * t3 + 3 * t2) * b[c]! +
      (t3 - t2) * m1;
  }
  return out;
}

const pos: V3 = [0, 0, 0];
const look: V3 = [0, 0, 0];

/**
 * The camera at p: position and look-at (shared tuples, overwritten on the next call).
 * Phones pull back along the view direction (the scene spreads wider than a portrait frame);
 * at p = 0 they stand close, the jar ~40% of the height, lifted clear of the headline below it.
 */
export function heroCamera(p: number, layout: HeroLayout, glide = 1): { pos: V3; look: V3 } {
  const x0 = jarStartX(layout, glide);
  const ofs = offsetFor(x0);
  track(p, (k) => k.pos, pos);
  track(p, (k) => k.look, look);
  // at p = 0 the camera follows the jar by 10% (the frame the opening glides into)
  const follow = 1 - smooth(0, 0.15, p);
  const x = (v: number) => v + ofs * (1 - follow) + follow * x0 * 0.1;
  pos[0] = x(pos[0]);
  look[0] = x(look[0]);
  let camZ = 1;
  if (layout.portrait) {
    camZ = 0.92 + (2.8 - 0.92) * smooth(0.03, 0.22, p);
    const lift = 0.035 * (1 - smooth(0.02, 0.12, p)); // clear of the headline
    pos[1] -= lift;
    look[1] -= lift;
    const right = 0.02 * smooth(0.15, 0.3, p); // keeps the resting cap in the narrow frame
    pos[0] += right;
    look[0] += right;
  }
  for (let c = 0; c < 3; c++) pos[c] = look[c]! + (pos[c]! - look[c]!) * camZ * LENS;
  return { pos, look };
}
