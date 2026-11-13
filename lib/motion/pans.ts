/**
 * Step 3, the pink salt pans (components/sections/SaltPans): the last PANS_VH of the hero's pin,
 * after the pour's hold. One scrubbed progress q (0–1), read by the DOM scene, the 3D scene (the
 * rise) and the sound. Pure: no GSAP, no three.js.
 *
 *   0–.20    RISE      the camera cranes up over the mound; the jar and cap drift out; the 3D
 *                      canvas fades and stops (its gold horizon becomes the field's far edge)
 *   .15–.45  ENGRAVE   canal, bunds, pans, mounds, figures, hatching; centre outwards
 *   .40–.75  COLOUR    the pans fill from the canal outwards: pale water, blush, Sambhar pink
 *   .55–.80  CRYSTALS  white crust grows in from the pans' edges; glints
 *   .60–.85  LINE      "The lake turns pink before it gives salt."
 *   .85–1    SETTLE    down into one pan; the pink softens to ivory; the gold rule of the next
 *                      section
 */
import { heroCamera, type HeroLayout } from './heroCamera';

export const PANS_VH = 2.8;
export const PANS = {
  rise: [0, 0.2],
  engrave: [0.15, 0.45],
  colour: [0.4, 0.75],
  crystals: [0.55, 0.8],
  line: [0.6, 0.85],
  settle: [0.85, 1],
} as const;

export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
export const span = (q: number, [a, b]: readonly [number, number]) => clamp01((q - a) / (b - a));
/** GSAP's power2.inOut. */
export const power2InOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

/** The pans' progress (0–1) from the hero section's box: its last PANS_VH viewport heights. */
export function pansProgress(section: HTMLElement): number {
  const vh = window.innerHeight;
  const rect = section.getBoundingClientRect();
  const start = rect.height - vh - PANS_VH * vh;
  return clamp01((-rect.top - start) / (PANS_VH * vh));
}

/**
 * Where the 3D horizon (the ground line z = 0) lands at the end of the rise: this far down the
 * screen (0 top, 1 bottom), on every screen shape (the vertical field of view is fixed). The SVG
 * field's far edge is placed there.
 */
export const HORIZON_AT = 0.3;
/** The craned camera: this high and this far back from the mound (metres). */
const TOP: readonly [number, number] = [0.9, 2.2];
const HALF_FOV = (12 * Math.PI) / 180; // FOV 24°

type V3 = [number, number, number];
const pos: V3 = [0, 0, 0];
const look: V3 = [0, 0, 0];

/**
 * The camera during the rise (t 0–1, already eased): from the pour's last frame up to a high,
 * level-yawed view down onto the mound at x = mx, the horizon line at HORIZON_AT of the height.
 */
export function riseCamera(t: number, layout: HeroLayout, mx: number): { pos: V3; look: V3 } {
  const from = heroCamera(1, layout);
  const [h, d] = TOP;
  // the line's angle below level, plus the offset that puts it at HORIZON_AT
  const below = Math.atan2(h, d) + Math.atan((1 - 2 * HORIZON_AT) * Math.tan(HALF_FOV));
  const end: V3 = [mx, h, d];
  const aim: V3 = [mx, h - Math.tan(below) * d, 0]; // d ahead of the camera, along the view
  for (let c = 0; c < 3; c++) {
    pos[c] = from.pos[c]! + (end[c]! - from.pos[c]!) * t;
    look[c] = from.look[c]! + (aim[c]! - from.look[c]!) * t;
  }
  return { pos, look };
}
