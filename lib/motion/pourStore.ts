import type { PourResult } from './pourSim';
import type { PourShape } from './film';

/**
 * The pour simulation's result (null until the worker has run), shared by the 3D scene, the
 * film's camera, the captions and the sound (the pour-loop follows its flow).
 */
let result: PourResult | null = null;
const listeners = new Set<() => void>();

export const pourStore = {
  get: () => result,
  set(r: PourResult | null) {
    result = r;
    listeners.forEach((fn) => fn());
  },
  subscribe(fn: () => void) {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
  /** What the film's camera needs of it. */
  shape(): PourShape | null {
    return result
      ? {
          onset: result.onset,
          stop: result.stop,
          moundH: result.mound.hEnd,
          levelEnd: result.levelEnd,
        }
      : null;
  },
};

/** Runs the simulation in a worker; resolves with its result (also put in the store). */
export function runPour(x0: number, grains: number, dust: number): Promise<PourResult> {
  return new Promise((resolve, reject) => {
    const w = new Worker(new URL('../../components/hero/scene/pourWorker.ts', import.meta.url), {
      type: 'module',
    });
    w.onmessage = (e: MessageEvent<PourResult>) => {
      w.terminate();
      pourStore.set(e.data);
      resolve(e.data);
    };
    w.onerror = (e) => {
      w.terminate();
      reject(e);
    };
    w.postMessage({ x0, grains, dust });
  });
}
