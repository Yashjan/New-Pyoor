import type { PerspectiveCamera } from 'three';
import { heroCamera } from '@/lib/motion/heroCamera';
import type { HeroLayout } from './layout';

/**
 * Places the camera for progress p (lib/motion/heroCamera.ts: the same pure camera the
 * Journey's step 2 aligns its engraving with). `glide` (0–1) is the opening's.
 */
export function cameraAt(
  camera: PerspectiveCamera,
  p: number,
  layout: HeroLayout,
  glide = 1,
): void {
  const { pos, look } = heroCamera(p, layout, glide);
  camera.position.set(pos[0], pos[1], pos[2]);
  camera.lookAt(look[0], look[1], look[2]);
}
