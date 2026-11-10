/** Small, pure helpers shared by the hero scene. Everything here is deterministic. */

export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/** Smoothstep from a to b. */
export function smooth(a: number, b: number, x: number): number {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
}

/** Cubic ease-in-out. */
export function ease(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/** Park–Miller minimal-standard RNG: the same seed always gives the same sequence. */
export function createRng(seed: number) {
  let s = seed;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-9)) * Math.cos(2 * Math.PI * rnd());
  return { rnd, gauss };
}
