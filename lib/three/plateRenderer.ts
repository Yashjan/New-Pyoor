import { WebGLRenderer, type Camera, type Object3D } from 'three';

/**
 * One WebGL renderer (one context) for every product plate, jar and pouch alike (ProductPlate,
 * Products/stage.ts): it draws offscreen, and each plate copies its frame onto its own 2D
 * canvas. Six plates no longer mean six contexts (Chrome drops the oldest past its limit), and
 * they share one shader cache, so a material compiled for one plate is ready for the next.
 */
let shared: { renderer: WebGLRenderer; w: number; h: number } | null = null;

export function plateRenderer(): WebGLRenderer {
  if (!shared) {
    const renderer = new WebGLRenderer({
      canvas: document.createElement('canvas'),
      antialias: true,
      alpha: true,
    });
    renderer.debug.checkShaderErrors = false;
    renderer.setPixelRatio(1); // sizes below are device pixels
    shared = { renderer, w: 1, h: 1 };
    renderer.setSize(1, 1, false);
  }
  return shared.renderer;
}

/**
 * Renders `scene` at w × h device pixels and copies it onto `target` (a 2D canvas the same
 * size). The shared drawing buffer only grows, so plates of different sizes never reallocate it
 * frame by frame.
 */
export function drawPlate(
  target: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  scene: Object3D,
  camera: Camera,
  w: number,
  h: number,
) {
  const renderer = plateRenderer();
  const s = shared!;
  if (w > s.w || h > s.h) {
    s.w = Math.max(s.w, w);
    s.h = Math.max(s.h, h);
    renderer.setSize(s.w, s.h, false);
  }
  // the bottom-left w × h of the buffer (GL's origin), cleared and drawn alone
  renderer.setViewport(0, 0, w, h);
  renderer.setScissor(0, 0, w, h);
  renderer.setScissorTest(true);
  renderer.render(scene, camera);
  renderer.setScissorTest(false);
  if (target.width !== w || target.height !== h) {
    target.width = w;
    target.height = h;
  }
  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(renderer.domElement, 0, s.h - h, w, h, 0, 0, w, h);
}
