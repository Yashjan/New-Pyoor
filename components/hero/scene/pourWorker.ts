/// <reference lib="webworker" />
/**
 * Runs the pour simulation (lib/motion/pourSim.ts) off the main thread, once, when the 3D
 * scene is built: { x0, grains, dust } in, the result out (its arrays transferred, not copied).
 */
import { simulatePour, type PourInput } from '@/lib/motion/pourSim';

self.onmessage = (e: MessageEvent<PourInput>) => {
  const r = simulatePour(e.data);
  const t = r.table;
  (self as unknown as Worker).postMessage(r, [
    r.grains.buffer,
    r.dust.buffer,
    t.level.buffer,
    t.volume.buffer,
    t.q.buffer,
  ]);
};
