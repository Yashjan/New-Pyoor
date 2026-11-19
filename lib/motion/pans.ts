/**
 * Step 3, the pink salt pans (components/sections/SaltPans): PANS_VH of the hero's pin, straight
 * after the film's dive (lib/motion/film.ts: the camera has come down onto the jar's crystals),
 * before "the lake opens" (openVh). One scrubbed progress q (0–1), read by the DOM scene, the 3D
 * scene (its crystal field gives way as the colour comes) and the sound. Pure: no GSAP, no
 * three.js.
 *
 *   0–.33    ENGRAVE   over the crystals: canal, bunds, pans, mounds, figures, hatching
 *   .26–.74  COLOUR    the crystals soften into the pans' fills: pale water, blush, pink
 *   .50–.98  CRYSTALS  white crust grows in from the pans' edges; glints
 *   .60–1    LINE      "The lake turns pink before it gives salt." (it leaves in the opening)
 */
export const PANS_VH = 1.0;
export const PANS = {
  engrave: [0, 0.33],
  colour: [0.26, 0.74],
  crystals: [0.5, 0.98],
  line: [0.6, 1],
} as const;

/**
 * "The lake opens" (components/sections/Products/LakeOpening): the last of the hero's pin, after
 * the pans: the field splits along its canal and the products rise. ~115vh (phones ~95vh).
 */
export const openVh = () =>
  typeof window !== 'undefined' && window.matchMedia('(max-width: 699px)').matches ? 0.95 : 1.15;
/** A ScrollTrigger position `vhs` screens before the pin's end (the hero's bottom at the bottom). */
export const beforeEnd = (vhs: number) => `bottom-=${Math.round(window.innerHeight * vhs)} bottom`;

export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
export const span = (q: number, [a, b]: readonly [number, number]) => clamp01((q - a) / (b - a));
/** GSAP's power2.inOut. */
export const power2InOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

/** The pans' progress (0–1) from the hero section's box: PANS_VH screens before the opening. */
export function pansProgress(section: HTMLElement): number {
  const vh = window.innerHeight;
  const rect = section.getBoundingClientRect();
  const start = rect.height - vh - (PANS_VH + openVh()) * vh;
  return clamp01((-rect.top - start) / (PANS_VH * vh));
}

/** The field's far edge (its gold horizon): this far down the screen (0 top, 1 bottom). */
export const HORIZON_AT = 0.3;
