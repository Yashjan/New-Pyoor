import type { PerspectiveCamera } from 'three';
import { Vector3 } from 'three';
import { clamp01, ease, smooth } from './math';
import type { HeroLayout } from './layout';
import { restX } from './jar';

type Vec3 = readonly [number, number, number];

interface Keyframe {
  p: number;
  pos: Vec3;
  look: Vec3;
}

/**
 * Camera keyframes over hero progress (metres; the jar is 12.2 cm tall).
 * From concept.html, with the HANDOFF fix: the look-at at p .42 and .74 is raised 1.5 cm so
 * the tilted jar sits slightly lower in frame.
 */
export const K: readonly Keyframe[] = [
  { p: 0, pos: [0.0, 0.1, 0.62], look: [0.0, 0.07, 0] },
  { p: 0.13, pos: [0.07, 0.14, 0.42], look: [0.12, 0.1, 0] },
  { p: 0.24, pos: [0.06, 0.15, 0.56], look: [0.1, 0.11, 0] },
  { p: 0.42, pos: [0.03, 0.13, 0.66], look: [0.05, 0.105, 0] },
  { p: 0.74, pos: [0.0, 0.1, 0.56], look: [0.03, 0.08, 0] },
  { p: 1, pos: [0.0, 0.2, 1.05], look: [0.0, 0.02, -1.4] },
];

const cp = new Vector3();
const cl = new Vector3();
const A = new Vector3();
const B = new Vector3();

/**
 * Places the camera for progress p. Pure: the same p, layout and glide give the same camera.
 * `glide` (0–1) is the opening's: the jar and the camera start centred.
 */
export function cameraAt(
  camera: PerspectiveCamera,
  p: number,
  layout: HeroLayout,
  glide = 1,
  pans = false,
): void {
  let i = 0;
  while (i < K.length - 2 && p > K[i + 1]!.p) i++;
  const k0 = K[i]!;
  const k1 = K[i + 1]!;
  const t = ease(clamp01((p - k0.p) / (k1.p - k0.p)));
  cp.copy(A.fromArray(k0.pos)).lerp(B.fromArray(k1.pos), t);
  cl.copy(A.fromArray(k0.look)).lerp(B.fromArray(k1.look), t);

  // Phones (HANDOFF to-do): before the tilt the keyframes pan right, which on a narrow portrait
  // frame pushes the upright jar and its lifting lid off the left edge. Hold the camera centred
  // until the jar tips, then ease the pan in with the tilt (.24–.42) so the pour frames match.
  if (layout.portrait) {
    const pan = smooth(0.24, 0.42, p);
    cp.x *= pan;
    cl.x *= pan;
  }

  // Follow the jar while it stands to the right of the headline (desktop).
  const jxShift = restX(p, layout, glide) * (1 - smooth(0.28, 0.44, p));
  cp.x += jxShift * 0.1;
  cl.x += jxShift * 0.1;

  // Phones: lift the frame while the jar is upright so it clears the beats' text. At p = 0
  // the jar stands centred, with the headline below it (the opening's end); the lift eases in
  // as the headline leaves, so the frames from p .2 on are as before.
  if (layout.camZ > 1) {
    const lift = 0.045 * smooth(0.03, 0.2, p) * (1 - smooth(0.7, 0.9, p));
    cl.y += lift;
    cp.y += lift;
  }

  // The salt pans: from the pour, one slow, low dolly forward at a 1.2 m eye height (the scene
  // is 1:10), tilted up a little so the horizon sits low and the sky holds the words.
  let camZ = layout.camZ;
  if (pans && p > 0.74) {
    const t = clamp01((p - 0.74) / 0.26);
    const k = smooth(0.78, 0.9, p);
    const glide = 0.5 * t + 0.5 * t * t * (3 - 2 * t);
    const endZ = layout.portrait ? 0.15 : -0.45;
    cp.set(0.03 * t, 0.1 + 0.02 * k, 0.56 + (endZ - 0.56) * glide);
    cl.set(0.03 - 0.01 * k, 0.08 + 0.25 * k, -3.4 * k);
    camZ = layout.camZ + (1 - layout.camZ) * k;
  }

  // Pull back along the view direction on portrait screens.
  cp.sub(cl).multiplyScalar(camZ).add(cl);
  camera.position.copy(cp);
  camera.lookAt(cl);
}
