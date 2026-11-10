import {
  ACESFilmicToneMapping,
  Clock,
  Color,
  DirectionalLight,
  Fog,
  HemisphereLight,
  PCFSoftShadowMap,
  PerspectiveCamera,
  PMREMGenerator,
  Scene,
  SRGBColorSpace,
  WebGLRenderer,
  Vector3,
} from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { openingPose, openingStore } from '@/lib/motion/opening';
import { disposeMaterial, disposeObject } from '@/lib/three/dispose';
import { loadJarModel } from '@/lib/three/loaders';
import type { QualityTier } from '@/lib/three/quality';
import { cameraAt } from './camera';
import { buildGrains, createGrainMesh, updateGrains } from './grains';
import { createGround } from './ground';
import { createJarRig, mouthAt, poseJar } from './jar';
import { layoutFor, type HeroLayout } from './layout';
import { smooth } from './math';

export interface JarSceneOptions {
  canvas: HTMLCanvasElement;
  tier: QualityTier;
  modelUrl: string;
  /** Hero scroll progress, 0–1. Read every frame. */
  getProgress: () => number;
  /** Called once, after the first frame is on screen (hide the poster then). */
  onFirstFrame: () => void;
  signal: AbortSignal;
  /** Download progress of the GLB, 0–1 (feeds the first-visit loader). */
  onModelProgress?: (fraction: number) => void;
}

export interface JarScene {
  dispose(): void;
}

declare global {
  interface Window {
    /** Read-only state for automated screenshots and debugging. */
    __pyoorHero?: { p: number; target: number; frames: number };
  }
}

const IVORY = new Color('#f5f1e8');
const SKY = new Color('#eee9df');
/** The idle turn while the jar is at rest: ~6° a second. */
const TURN_RATE = (6 * Math.PI) / 180;

const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

export async function createJarScene(opts: JarSceneOptions): Promise<JarScene> {
  const { canvas, tier, signal } = opts;
  // `?heroStill` freezes the idle float and pointer parallax (for screenshots).
  const still = new URLSearchParams(window.location.search).has('heroStill');
  // Start the download first so it overlaps the renderer and environment setup below.
  const modelLoad = loadJarModel(opts.modelUrl, signal, opts.onModelProgress);
  modelLoad.catch(() => {}); // handled where it is awaited

  // ---- renderer, scene, light (from concept.html) ----
  // Transparent: the page's ivory (and the opening's dawn glow) shows behind the jar. The salt
  // flats' sky is the clear colour, faded in over the ivory (the same mix as before).
  const renderer = new WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance',
  });
  renderer.setClearColor(SKY, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, tier.maxDpr));
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.shadowMap.enabled = tier.shadows;
  renderer.shadowMap.type = PCFSoftShadowMap;

  const scene = new Scene();
  const fogColor = IVORY.clone();
  scene.fog = new Fog(fogColor, 2.2, 9);
  const pmrem = new PMREMGenerator(renderer);
  const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
  scene.environment = envRT.texture;

  const camera = new PerspectiveCamera(30, 1, 0.01, 40);
  const key = new DirectionalLight(0xfff0dc, 2.4);
  key.position.set(0.6, 1.2, 0.8);
  key.castShadow = tier.shadows;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.radius = 5;
  key.shadow.bias = -0.0004;
  Object.assign(key.shadow.camera, {
    left: -0.5,
    right: 0.5,
    top: 0.5,
    bottom: -0.5,
    near: 0.1,
    far: 4,
  });
  const rim = new DirectionalLight(0xe9c98a, 1.2);
  rim.position.set(-0.8, 0.5, -0.6);
  // The opening's rim light: catches the lid's edge from behind as the jar rises (gold-300).
  const lidRim = new DirectionalLight(0xcda75e, 0);
  lidRim.position.set(0.25, 0.9, -1);
  scene.add(key, rim, lidRim, new HemisphereLight(0xffffff, 0xe8dfcd, 0.35));

  const ground = createGround();
  // The jar rises through the floor plane in the opening: the (invisible) shadow floor must not
  // hide the clear jar below it.
  ground.shadowMat.depthWrite = false;
  scene.add(ground.contact, ground.shadowFloor, ground.crust, ground.horizon);

  // ---- the jar ----
  // Setup runs while the first-visit intro is on screen: yield a frame between the heavy steps
  // so their costs don't stack into one long stall.
  await nextFrame();
  let gltf;
  try {
    gltf = await modelLoad;
  } catch (err) {
    renderer.dispose();
    pmrem.dispose();
    envRT.dispose();
    throw err;
  }
  const rig = createJarRig(gltf.scene);
  scene.add(rig.pivot);

  const grainMesh = createGrainMesh(tier.grains, tier.shadows);
  scene.add(grainMesh);

  let layout: HeroLayout = layoutFor(canvas.clientWidth || 1, canvas.clientHeight || 1);
  let mouth: Vector3 = mouthAt(rig, layout);
  let grains = buildGrains(grainMesh, mouth);

  const resize = () => {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    const next = layoutFor(w, h);
    if (next.portrait !== layout.portrait) {
      layout = next;
      mouth = mouthAt(rig, layout); // the jar moves, so the pour starts from a new mouth
      grains = buildGrains(grainMesh, mouth);
    }
    layout = next;
  };
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();

  // ---- pointer parallax (only matters while the jar is at rest) ----
  const pointer = { x: 0, y: 0 };
  const target = { x: 0, y: 0 };
  const onPointer = (e: PointerEvent) => {
    target.x = e.clientX / window.innerWidth - 0.5;
    target.y = e.clientY / window.innerHeight - 0.5;
  };
  if (!still) window.addEventListener('pointermove', onPointer, { passive: true });

  // ---- pause while the hero is off-screen ----
  let visible = true;
  const io = new IntersectionObserver((entries) => {
    visible = entries[0]?.isIntersecting ?? true;
  });
  io.observe(canvas);

  // ---- loop ----
  const clock = new Clock();
  const jarBase = new Vector3();
  let sp = opts.getProgress(); // smoothed progress
  let frames = 0;
  let raf = 0;
  let turn = 0;
  window.__pyoorHero = { p: sp, target: sp, frames };

  const frame = () => {
    raf = requestAnimationFrame(frame);
    if (!visible) {
      clock.getDelta(); // don't let time pile up while paused
      return;
    }
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = still ? 0 : clock.elapsedTime;
    const goal = opts.getProgress();
    sp += (goal - sp) * Math.min(1, dt * 7);
    if (Math.abs(goal - sp) < 1e-5) sp = goal; // settle exactly, so frames repeat exactly
    const p = sp;
    pointer.x += (target.x - pointer.x) * 0.05;
    pointer.y += (target.y - pointer.y) * 0.05;

    // The opening (components/opening): the sunrise from 30% of the screen height below, the
    // glide to 62%, the idle turn while at rest (it starts once the jar has begun to rise).
    const op = openingPose(openingStore.get());
    const rest = 1 - smooth(0.02, 0.14, p);
    if (!still && rest >= 1 && op.rise > 0) turn = (turn + dt * TURN_RATE) % (2 * Math.PI);
    const viewH = 2 * Math.tan((camera.fov * Math.PI) / 360) * 0.62 * layout.camZ;
    poseJar(rig, p, t, pointer, layout, {
      rise: op.rise,
      riseFrom: 0.3 * viewH,
      glide: op.glide,
      turn: turn > Math.PI ? turn - 2 * Math.PI : turn,
    });
    lidRim.intensity = 2.2 * op.rise * rest;
    // Contact shadow follows the jar's base and fades as the jar tips up off the floor.
    rig.pivot.updateMatrixWorld(true);
    rig.jar.getWorldPosition(jarBase);
    ground.contact.position.x = jarBase.x;
    ground.contact.position.z = jarBase.z;
    updateGrains(grainMesh, grains, mouth, p);

    // Salt flats: the crust fades in, the sky warms, the gold horizon appears.
    const flat = smooth(0.78, 0.93, p);
    ground.crustMat.opacity = flat;
    ground.shadowMat.opacity = 0.12 * (1 - flat);
    const contactFade =
      (1 - smooth(0.24, 0.36, p)) * (rig.pivot.visible ? 1 : 0) * op.rise * op.rise;
    for (const [mat, base] of ground.contactMats) mat.opacity = base * contactFade;
    ground.horizonMat.opacity = smooth(0.86, 0.97, p) * 0.9;
    renderer.setClearColor(SKY, flat);
    fogColor.copy(IVORY).lerp(SKY, flat);

    cameraAt(camera, p, layout, op.glide);
    renderer.render(scene, camera);

    frames++;
    window.__pyoorHero = { p, target: goal, frames };
    if (frames === 1) opts.onFirstFrame();
  };
  // Compile every material before the first frame, in parallel where the driver supports it
  // (KHR_parallel_shader_compile), instead of blocking the page for ~0.2–0.7 s on first render.
  await nextFrame();
  try {
    await renderer.compileAsync(scene, camera);
  } catch {
    // older drivers: the first render compiles them instead
  }
  if (signal.aborted) {
    disposeObject(scene);
    envRT.dispose();
    pmrem.dispose();
    renderer.dispose();
    throw new DOMException('Aborted', 'AbortError');
  }
  raf = requestAnimationFrame(frame);

  return {
    dispose() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      window.removeEventListener('pointermove', onPointer);
      disposeObject(scene);
      disposeMaterial(ground.crustMat);
      envRT.dispose();
      pmrem.dispose();
      renderer.dispose();
      delete window.__pyoorHero;
    },
  };
}
