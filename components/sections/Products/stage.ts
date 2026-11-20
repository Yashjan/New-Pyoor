import { PerspectiveCamera, type Material, type Mesh, type Texture } from 'three';
import { createTurn } from '@/components/hero/scene/turn';
import { coveredStore } from '@/lib/motion/covered';
import { pickQualityTier } from '@/lib/three/quality';
import { precompile } from '@/lib/three/precompile';
import { drawPlate, plateRenderer } from '@/lib/three/plateRenderer';
import { whenCalm } from '@/lib/three/calm';
import { SHOW_FULL_LABEL, SHOW_POUCH_BACK } from '@/lib/commerce/pricing';

/** `?still`: no idle sway (the dead-scroll test measures only what scrolling changes). */
const STILL =
  typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('still');
import { loadPlateModel, plateCamera, studioScene, type Format } from './plateScene';

/** The hold's slow turn, as the hero jar's: ±7° on y over 9 s. */
const SWAY = (7 * Math.PI) / 180;
const SWAY_PERIOD = 9;
/** The turn limit while SHOW_POUCH_BACK / SHOW_FULL_LABEL is false (lib/commerce/pricing.ts). */
const LIMIT = (60 * Math.PI) / 180;

export interface Stage {
  /** The format switch: 0 = in place, 1 = turned 90° away (dir: which way). */
  away(p: number, dir: 1 | -1): void;
  /** Whether it may draw (the active format, or one mid-switch). */
  setActive(on: boolean): void;
  dispose(): void;
}

/**
 * One live plate model (ProductPlate), drawn by the plates' shared renderer
 * (lib/three/plateRenderer.ts) and copied onto its own canvas, drawing only
 * while on screen, active, the tab visible and nothing covering the page. Idle sway and
 * drag-to-rotate as the hero jar (hero/scene/turn.ts: horizontal drags on touch, the wheel
 * never taken, ←/→ when focused, back to the front after 4 s).
 */
export async function createStage(
  canvas: HTMLCanvasElement,
  format: Format,
  url: string,
  signal: AbortSignal,
  onFirstFrame: () => void,
): Promise<Stage> {
  const tier = pickQualityTier();
  await whenCalm(signal);
  const renderer = plateRenderer();
  const dpr = Math.min(window.devicePixelRatio, tier?.name === 'weak' ? 1.25 : 2);
  const ctx = canvas.getContext('2d')!;
  const studio = studioScene(renderer);
  const camera = new PerspectiveCamera();
  let model;
  try {
    model = await loadPlateModel(format, url, signal);
  } catch (err) {
    studio.dispose();
    throw err;
  }
  await whenCalm(signal);
  studio.scene.add(model.root);
  plateCamera(camera, model);
  const m = model;

  let pw = 1;
  let ph = 1;
  const resize = () => {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (w && h) {
      pw = Math.round(w * dpr);
      ph = Math.round(h * dpr);
    }
  };
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();
  const draw = () => drawPlate(canvas, ctx, studio.scene, camera, pw, ph);
  await precompile(renderer, studio.scene, camera, signal);
  // Warm-up, unseen: one material per calm moment (without parallel compile, linking every
  // program in one render freezes the page), textures uploaded, never to the visible canvas.
  {
    const mats = new Map<Material, boolean>();
    studio.scene.traverse((o) => {
      const mm = (o as Mesh).material;
      if (mm) (Array.isArray(mm) ? mm : [mm]).forEach((x) => mats.set(x, x.visible));
    });
    studio.scene.traverse((o) => {
      const mm = (o as Mesh).material as (Material & { map?: Texture | null }) | undefined;
      if (mm && !Array.isArray(mm) && mm.map) renderer.initTexture(mm.map);
    });
    // (to the shared canvas, never shown: an offscreen target would compile other variants)
    for (const mat of mats.keys()) {
      await whenCalm(signal);
      mats.forEach((_, x) => (x.visible = x === mat));
      draw();
    }
    mats.forEach((v, x) => (x.visible = v));
    await whenCalm(signal);
    draw();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  const turn = createTurn(canvas, () => {});
  let visible = false;
  let active = false;
  let awayP = 0;
  let awayDir: 1 | -1 = 1;
  let t = 0;
  let last = performance.now();
  let raf = 0;
  let first = true;
  const io = new IntersectionObserver(([e]) => {
    visible = !!e?.isIntersecting;
    wake();
  });
  io.observe(canvas);

  const frame = (now: number) => {
    raf = 0;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!visible || !active || document.hidden || coveredStore.get()) return;
    turn.update(dt, awayP === 0);
    if (!STILL) t += dt * turn.sway;
    const sway = Math.sin((2 * Math.PI * t) / SWAY_PERIOD) * SWAY * turn.sway;
    // the pouch's back stays out of sight while its artwork is being corrected
    // and the jars' label side panels (SHOW_FULL_LABEL)
    if ((format === 'pouch' && !SHOW_POUCH_BACK) || (format === 'jar' && !SHOW_FULL_LABEL))
      turn.yaw = Math.max(-LIMIT + SWAY, Math.min(LIMIT - SWAY, turn.yaw));
    m.pose(turn.yaw + sway + awayDir * awayP * (Math.PI / 2), turn.tilt);
    draw();
    if (first) {
      first = false;
      onFirstFrame();
    }
    raf = requestAnimationFrame(frame);
  };
  const wake = () => {
    if (raf || !visible || !active) return;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  };
  const onVis = () => wake();
  document.addEventListener('visibilitychange', onVis);
  const unsub = coveredStore.subscribe(wake);

  return {
    away(p, dir) {
      awayP = p;
      awayDir = dir;
    },
    setActive(on) {
      active = on;
      wake();
    },
    dispose() {
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      turn.dispose();
      unsub();
      document.removeEventListener('visibilitychange', onVis);
      studio.dispose(); // (the shared renderer stays for the other plates)
    },
  };
}
