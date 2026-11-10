/**
 * Quality tier for the 3D hero, chosen once from the device.
 *
 *   high   desktop               6,000 grains, DPR ≤ 2, realtime shadows
 *   phone  ≤ 860 px wide         2,800 grains, DPR ≤ 2, realtime shadows
 *   weak   < 4 GB or < 4 cores   1,500 grains, DPR ≤ 1.25, no shadows
 *
 * `null` means no WebGL at all (reduced motion or no WebGL support): the poster stays.
 */
export interface QualityTier {
  name: 'high' | 'phone' | 'weak';
  grains: number;
  maxDpr: number;
  shadows: boolean;
}

interface NavigatorWithMemory extends Navigator {
  deviceMemory?: number;
}

export function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function hasWebGL2(): boolean {
  try {
    return !!document.createElement('canvas').getContext('webgl2');
  } catch {
    return false;
  }
}

export function pickQualityTier(): QualityTier | null {
  if (prefersReducedMotion() || !hasWebGL2()) return null;
  const nav = navigator as NavigatorWithMemory;
  const weak =
    (nav.deviceMemory !== undefined && nav.deviceMemory < 4) ||
    (nav.hardwareConcurrency !== undefined && nav.hardwareConcurrency < 4);
  if (weak) return { name: 'weak', grains: 1500, maxDpr: 1.25, shadows: false };
  const small = window.matchMedia('(max-width: 860px)').matches;
  if (small) return { name: 'phone', grains: 2800, maxDpr: 2, shadows: true };
  return { name: 'high', grains: 6000, maxDpr: 2, shadows: true };
}
