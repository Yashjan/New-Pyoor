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

/** The engraving draws in one steady pass of 2.4 s, ease-in-out (the rest is CSS keyframes). */
export const ENGRAVE = 2.4;
/** When the engraving reaches progress e (seconds): the inverse of the ease-in-out curve. */
export const clockTime = (e: number) =>
  ENGRAVE * (e < 0.5 ? Math.cbrt(e / 4) : 1 - Math.cbrt(2 * (1 - e)) / 2);
