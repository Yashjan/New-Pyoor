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
 * The engraving takes 1.2 s at the fastest and 3 s at the most: it follows the real load
 * progress, spring-smoothed and speed-capped, and never falls behind a 3 s clock.
 */
export const ENGRAVE_MIN = 1.2;
export const ENGRAVE_MAX = 3;

/**
 * After the engraving, in seconds (one thing at a time, overlapping by at most 30%):
 * the ink spreads from the gold line, the outline fades, a glint runs along the line,
 * then the header, the small line and the scroll cue.
 */
export const AFTER = {
  fill: [0, 0.8],
  outline: [0.56, 1],
  glint: [0.9, 1.6],
  header: [1.45, 2.05],
  body: [1.88, 2.48],
  cue: [2.3, 2.9],
} as const;
/** Scrolling is held until the glint has run; the intro counts as done after the cue. */
export const UNLOCK_AT = AFTER.glint[1];
export const DONE_AT = AFTER.cue[1];

export const phase = (t: number, [a, b]: readonly [number, number]) => clamp01((t - a) / (b - a));
