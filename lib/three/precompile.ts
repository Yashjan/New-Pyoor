import { WebGLRenderTarget, type Camera, type Object3D, type WebGLRenderer } from 'three';
import { whenCalm } from './calm';

/**
 * Compiles every shader a scene will need, in parallel where the driver supports it
 * (KHR_parallel_shader_compile), so no frame ever waits for a program to link:
 * - the canvas variants (the renderer's tone mapping and output colour space), and
 * - the render-target variants (linear, no tone mapping) that the transmission pre-pass of a
 *   glass material renders the opaque objects with; without these, the first frames with the
 *   glass in view link them one by one, synchronously (~0.1–0.25 s each).
 * Then each program is linked on purpose, one per calm idle moment (lib/three/calm.ts): where the
 * driver only links when a program is first used (no real parallel compile), that first use
 * would otherwise land inside a frame while scrolling.
 */
export async function precompile(
  renderer: WebGLRenderer,
  scene: Object3D,
  camera: Camera,
  signal?: AbortSignal,
  /** how long each link may wait for the visitor to pause scrolling (ms) */
  maxWait = 2500,
) {
  try {
    await renderer.compileAsync(scene, camera);
    const rt = new WebGLRenderTarget(2, 2);
    const prev = renderer.getRenderTarget();
    renderer.setRenderTarget(rt);
    try {
      await renderer.compileAsync(scene, camera);
    } finally {
      renderer.setRenderTarget(prev);
      rt.dispose();
    }
  } catch {
    // older drivers: the first renders compile them instead
  }
  const programs = (renderer.info.programs ?? []) as unknown as { getUniforms(): unknown }[];
  for (const program of programs) {
    await whenCalm(signal, maxWait);
    program.getUniforms(); // waits for the link (cached afterwards)
  }
}
