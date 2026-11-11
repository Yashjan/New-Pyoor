import { clamp01 } from '@/lib/motion/opening';

/**
 * The engraving: each letter is one continuous pen movement over its own window of the
 * engraving progress e (0–1). The outer contour runs 0→100% of the window; the counters
 * (A, B, R) start once the outer contour reaches 60%. Windows stagger left to right, each
 * overlapping the next by 40%, so the word reads S, SA, SAM…
 */
export const LETTERS = 7;
export const OVERLAP = 0.4;
export const COUNTER_START = 0.6;
/** One letter's window: 7 windows, each starting 60% into the previous one, fill 0–1. */
export const WINDOW = 1 / (1 + (LETTERS - 1) * (1 - OVERLAP));
export const letterStart = (i: number) => i * WINDOW * (1 - OVERLAP);

/** How far letter i's outer contour (and its counters) are drawn at engraving progress e. */
export function letterDraw(i: number, e: number): { outer: number; counter: number } {
  const t = clamp01((e - letterStart(i)) / WINDOW);
  return { outer: t, counter: clamp01((t - COUNTER_START) / (1 - COUNTER_START)) };
}

/**
 * The engraving draws on time alone: one steady pass of 2.4 s, ease-in-out. Load progress only
 * decides when the loader ends (the finished word is held, shimmering, for at most HOLD_MAX).
 */
export const ENGRAVE = 2.4;
export const HOLD_MAX = 4;
const inOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
/** Engraving progress at t seconds. */
export const clockProgress = (t: number) => inOut(clamp01(t / ENGRAVE));
/** The inverse: when the engraving reaches progress e (seconds). */
export const clockTime = (e: number) =>
  ENGRAVE * (e < 0.5 ? Math.cbrt(e / 4) : 1 - Math.cbrt(2 * (1 - e)) / 2);

/**
 * After the engraving, in seconds (one thing at a time, overlapping by at most 30%):
 * the ink spreads from the seam, the outline fades, then the header, the small line and
 * the scroll cue.
 */
export const AFTER = {
  fill: [0, 0.8],
  outline: [0.56, 1],
  header: [1, 1.6],
  body: [1.42, 2.02],
  cue: [1.84, 2.44],
} as const;
/** Scrolling is held until the outline has faded; the intro counts as done after the cue. */
export const UNLOCK_AT = AFTER.outline[1];
export const DONE_AT = AFTER.cue[1];

export const phase = (t: number, [a, b]: readonly [number, number]) => clamp01((t - a) / (b - a));
