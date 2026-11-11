/**
 * Real load progress for the first-visit loader: each part reports 0–1, weighted as
 *   fonts (document.fonts.ready) 20% · three.js 15% + GSAP 15% · the jar GLB 50%.
 * Parts that won't load on this device (no WebGL, reduced motion) report 1 straight away.
 */
const WEIGHTS = { fonts: 0.2, three: 0.15, gsap: 0.15, model: 0.5 } as const;
export type LoadPart = keyof typeof WEIGHTS;

const parts: Record<LoadPart, number> = { fonts: 0, three: 0, gsap: 0, model: 0 };
const listeners = new Set<(p: number) => void>();

export function loadProgress(): number {
  let sum = 0;
  for (const k of Object.keys(WEIGHTS) as LoadPart[]) sum += WEIGHTS[k] * parts[k];
  return Math.min(1, sum);
}

/** Progress only moves forwards, so a retried request can't pull the line back. */
export function reportLoad(part: LoadPart, fraction: number): void {
  const f = Math.min(1, Math.max(0, Number.isFinite(fraction) ? fraction : 0));
  if (f <= parts[part]) return;
  parts[part] = f;
  const p = loadProgress();
  listeners.forEach((fn) => fn(p));
}

/** How far one part has got (0–1). */
export function partProgress(part: LoadPart): number {
  return parts[part];
}

export function onLoadProgress(fn: (p: number) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** The full first-visit intro is running (set before first paint in app/layout.tsx). */
export function introIsFull(): boolean {
  const d = document.documentElement;
  return d.dataset.intro === 'full' && !d.hasAttribute('data-intro-done');
}
