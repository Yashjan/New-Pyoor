/**
 * Heavy 3D work (WebGL contexts, model parsing, shader compiles, texture uploads) is done only
 * while the page is calm: in an idle moment, and not within CALM_MS of the last scroll. Tasks
 * run one at a time (calmQueue), so two plates never compile in the same moment.
 */
const CALM_MS = 300;
let lastScroll = -Infinity;
if (typeof window !== 'undefined')
  window.addEventListener('scroll', () => (lastScroll = performance.now()), { passive: true });

const idle = () =>
  new Promise<void>((resolve) => {
    if (window.requestIdleCallback) window.requestIdleCallback(() => resolve(), { timeout: 1500 });
    else window.setTimeout(resolve, 50);
  });

/**
 * Resolves in an idle moment at least CALM_MS after the last scroll, or, if the visitor never
 * pauses, after `maxWait` ms anyway (a stalled frame then, rather than a scene that never comes).
 */
export async function whenCalm(signal?: AbortSignal, maxWait = 2500): Promise<void> {
  const until = performance.now() + maxWait;
  for (;;) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    if (performance.now() >= until) return;
    const wait = Math.min(CALM_MS - (performance.now() - lastScroll), until - performance.now());
    if (wait > 0) await new Promise((r) => window.setTimeout(r, wait + 20));
    await idle();
    if (performance.now() - lastScroll >= CALM_MS) return;
  }
}

let tail: Promise<unknown> = Promise.resolve();
/** Runs `task` after every task queued before it (failures don't stop the queue). */
export function calmQueue<T>(task: () => Promise<T>): Promise<T> {
  const run = tail.then(task, task);
  tail = run.catch(() => {});
  return run;
}
