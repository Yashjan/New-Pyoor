import { coveredStore } from '@/lib/motion/covered';
import {
  ACESFilmicToneMapping,
  Box3,
  ImageBitmapLoader,
  LinearMipmapLinearFilter,
  Texture,
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
  BufferGeometry,
  Float32BufferAttribute,
  Line,
  LineBasicMaterial,
  type Mesh,
  type Material,
} from 'three';
import { studioEnvironment } from './studio';
import { dressJar } from './materials';
import { heroShare } from '@/lib/three/heroShare';
import { asset } from '@/lib/basePath';
import { journeyStore, openingPose, openingStore } from '@/lib/motion/opening';
import { disposeObject } from '@/lib/three/dispose';
import { loadJarModel } from '@/lib/three/loaders';
import type { QualityTier } from '@/lib/three/quality';
import { loadGsap } from '@/lib/motion/gsap';
import { createPour, type Pour } from './grains';
import { precompile } from '@/lib/three/precompile';
import { createSaltBody, type SaltBody } from './saltBody';
import { createContact, createGround } from './ground';
import { createJarRig, poseCap, poseJar } from './jar';
import { capRest, R } from '@/lib/motion/pour';
import { FOV, jarStartX } from '@/lib/motion/heroCamera';
import { filmCamera, smooth } from '@/lib/motion/film';
import { moundHeightAt, simulatePour, type PourResult } from '@/lib/motion/pourSim';
import { pourStore, runPour } from '@/lib/motion/pourStore';
import { PANS } from '@/lib/motion/pans';
import { layoutFor, type HeroLayout } from './layout';
import { createTurn } from './turn';

export interface JarSceneOptions {
  canvas: HTMLCanvasElement;
  tier: QualityTier;
  modelUrl: string;
  /**
   * How long each shader link may wait for a pause in scrolling (ms): 0 when the visitor is
   * already scrolling towards the film (the jar is needed now), longer when built at rest.
   */
  linkWait?: number;
  /** The film's progress, 0–1 (lib/motion/film.ts). Read every frame. */
  getProgress: () => number;
  /** Called once, after the first frame is on screen (hide the poster then). */
  onFirstFrame: () => void;
  signal: AbortSignal;
  /** Download progress of the GLB, 0–1 (feeds the first-visit loader). */
  onModelProgress?: (fraction: number) => void;
  /** Step 3's progress, 0–1 (lib/motion/pans.ts): the canvas gives way as the pans colour. */
  getPans?: () => number;
  /** The visitor has turned the jar for the first time (turn.ts). */
  onFirstTurn?: () => void;
}

export interface JarScene {
  dispose(): void;
}

declare global {
  interface Window {
    /** Read-only state for automated screenshots and debugging. */
    __pyoorHero?: {
      p: number;
      target: number;
      frames: number;
      /** the jar's projected box in client px, and whether the canvas is shown (tests) */
      box?: [number, number, number, number];
      shown?: boolean;
    };
  }
}

const IVORY = new Color('#f5f1e8');
const SKY = new Color('#eee9df');
/** The hold's slow turn: ±7° on y, back and forth over 9 s (a sine). */
const TURN = (7 * Math.PI) / 180;
const TURN_PERIOD = 9;
/** The key light's direction (from the jar): it eases towards the cursor, ±25°. */
const KEY_DIR = new Vector3(0.6, 1.2, 0.8);
const KEY_SWING = (25 * Math.PI) / 180;
const Y_AXIS = new Vector3(0, 1, 0);
/** The label at print sharpness (tools/3d/label_textures.py), loaded after the first frame. */
const LABEL_4K = '/textures/label-herbal-black-salt-4096.webp';

const idle = () =>
  new Promise<void>((resolve) =>
    window.requestIdleCallback
      ? window.requestIdleCallback(() => resolve(), { timeout: 500 })
      : window.setTimeout(resolve, 16),
  );
const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

/**
 * The product film's 3D (lib/motion/film.ts): the jar on the horizon, the macro unscrew, the
 * orbit, the pour (simulated in a worker: lib/motion/pourSim.ts), the mound, the dive into the
 * jar's crystals. One render per GSAP tick, a pure function of the film's progress.
 */
export async function createJarScene(opts: JarSceneOptions): Promise<JarScene> {
  const { canvas, tier, signal } = opts;
  // `?heroStill` (or `?still`: every ambient loop, for the dead-scroll test) freezes the idle
  // float and pointer parallax (for screenshots).
  const qs = new URLSearchParams(window.location.search);
  const still = qs.has('heroStill') || qs.has('still');
  const weak = tier.name === 'weak';
  // Start the download first so it overlaps the renderer and environment setup below.
  const modelLoad = loadJarModel(opts.modelUrl, signal, opts.onModelProgress);
  modelLoad.catch(() => {}); // handled where it is awaited
  let layout: HeroLayout = layoutFor(canvas.clientWidth || 1, canvas.clientHeight || 1);
  // the pour, simulated in a worker meanwhile (the main thread as a fallback)
  const grainsFor = Math.round(tier.grains * 0.85);
  const dustFor = weak ? 0 : Math.round(tier.grains * 0.15);
  const simulate = (x0: number) =>
    runPour(x0, grainsFor, dustFor).catch(() => {
      const r = simulatePour({ x0, grains: grainsFor, dust: dustFor });
      pourStore.set(r);
      return r;
    });
  const simLoad = simulate(jarStartX(layout));

  // ---- renderer, scene, light (from concept.html) ----
  // Transparent: the page's ivory (and the opening's dawn glow) shows behind the jar.
  const renderer = new WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance',
  });
  // No error log reads: getProgramInfoLog waits for the compile, which turns the parallel
  // (KHR_parallel_shader_compile) compile back into a ~1–2 s freeze of the page.
  renderer.debug.checkShaderErrors = false;
  renderer.setClearColor(SKY, 0);
  renderer.localClippingEnabled = true; // the salt's world-level surface (saltBody.ts)
  // DPR: the tier's cap while scrolling; up to 2 once the page has rested for 300 ms
  const scrollDpr = Math.min(window.devicePixelRatio, tier.maxDpr);
  const restDpr = weak ? scrollDpr : Math.min(window.devicePixelRatio, 2);
  let dpr = scrollDpr;
  renderer.setPixelRatio(dpr);
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.shadowMap.enabled = tier.shadows;
  renderer.shadowMap.type = PCFSoftShadowMap;

  const scene = new Scene();
  scene.fog = new Fog(IVORY.clone(), 2.2, 9);
  const pmrem = new PMREMGenerator(renderer);
  const envRT = studioEnvironment(pmrem);
  scene.environment = envRT.texture;

  const camera = new PerspectiveCamera(FOV, 1, 0.002, 40);
  const key = new DirectionalLight(0xfff0dc, 2.4);
  key.position.copy(KEY_DIR);
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
  const hemi = new HemisphereLight(0xffffff, 0xe8dfcd, 0.35);
  // The pour's warm light: low, from the upper right, so falling grains and crystals glint.
  const dusk = new DirectionalLight(0xffc27a, 1.5);
  dusk.position.set(0.9, 0.28, 0.5);
  scene.add(key, key.target, rim, lidRim, hemi, dusk);

  const ground = createGround();
  // The jar rises through the floor plane in the opening: the (invisible) shadow floor must not
  // hide the clear jar below it.
  ground.shadowMat.depthWrite = false;
  scene.add(ground.contact, ground.shadowFloor);
  // Soft contact shadows under the resting cap and the mound.
  const capShadow = createContact();
  capShadow.group.scale.set(0.95, 1, 0.95);
  const moundShadow = createContact();
  scene.add(capShadow.group, moundShadow.group);
  // The gold horizon: a 1px line on the ground through the jar's base (and the mound's), so on
  // screen it runs exactly at their foot; the jar, its salt and the mound hide it where they stand.
  const horizonLine = new Line(
    new BufferGeometry().setAttribute(
      'position',
      new Float32BufferAttribute([-4, 0.0003, 0, 4, 0.0003, 0], 3),
    ),
    new LineBasicMaterial({ color: 0xa8823f, toneMapped: false, fog: false }),
  );
  scene.add(horizonLine);

  // ---- the jar ----
  // Setup runs while the first-visit intro is on screen: yield a frame between the heavy steps
  // so their costs don't stack into one long stall.
  await nextFrame();
  let gltf;
  let sim: PourResult;
  try {
    [gltf, sim] = await Promise.all([modelLoad, simLoad]);
  } catch (err) {
    renderer.dispose();
    pmrem.dispose();
    envRT.dispose();
    throw err;
  }
  const rig = createJarRig(gltf.scene);
  const lidBottom = new Box3().setFromObject(rig.lid).min.y;
  scene.add(rig.pivot, rig.lid);
  const look = dressJar(rig, !weak, lidBottom);
  const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();
  const glbLabel = look.label.map;
  if (glbLabel) glbLabel.anisotropy = maxAnisotropy;
  let label4k: Texture | null = null;
  const crystals = weak ? 300 : tier.name === 'high' ? 1600 : 900;
  let salt: SaltBody = createSaltBody(rig, sim, !weak, crystals);
  /** The jar's axis projected to client px: [x base, y top, x top, y base] (tests). */
  const bb = new Box3();
  const lidBox = new Box3();
  const corner = new Vector3();
  const jarBox = (): [number, number, number, number] => {
    bb.setFromObject(rig.jar).union(lidBox.setFromObject(rig.lid));
    const r = canvas.getBoundingClientRect();
    // the jar's axis (base centre to cap-top centre): its true centre on screen, which a
    // box of projected 3D corners isn't (perspective spreads the near corners)
    const ends = [bb.min.y, bb.max.y].map((y) => {
      corner.set((bb.min.x + bb.max.x) / 2, y, (bb.min.z + bb.max.z) / 2).project(camera);
      return [
        r.left + ((corner.x + 1) / 2) * r.width,
        r.top + ((1 - corner.y) / 2) * r.height,
      ] as const;
    });
    const [x0, y1] = ends[0]!;
    const [x1, y0] = ends[1]!;
    return [x0, y0, x1, y1];
  };

  // the pour, played back from the simulation
  let pour: Pour = createPour(sim, jarStartX(layout), tier.shadows, !weak);
  const addPour = () => scene.add(...pour.group, pour.mound);
  addPour();

  const resize = () => {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    const next = layoutFor(w, h);
    if (next.portrait !== layout.portrait) {
      // the jar starts elsewhere, so the pour (and its mound) is simulated again from there
      const x0 = jarStartX(next);
      void simulate(x0).then((r) => {
        if (signal.aborted) return;
        scene.remove(...pour.group, pour.mound);
        pour.dispose();
        pour = createPour(r, x0, tier.shadows, !weak);
        addPour();
        salt.dispose();
        salt = createSaltBody(rig, r, !weak, crystals);
        sim = r;
      });
    }
    layout = next;
  };
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  // phones: the address bar showing/hiding (sized before the next frame, never after it)
  window.visualViewport?.addEventListener('resize', resize);
  resize();

  // ---- the pointer: parallax at rest, and the key light follows it ----
  const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const pointer = { x: 0, y: 0 };
  const target = { x: 0, y: 0 };
  const light = { x: 0, y: 0 };
  const onPointer = (e: PointerEvent) => {
    target.x = e.clientX / window.innerWidth - 0.5;
    target.y = e.clientY / window.innerHeight - 0.5;
  };
  if (!still) window.addEventListener('pointermove', onPointer, { passive: true });

  // ---- the visitor turns the jar (rest state only) ----
  const turnCtl = createTurn(canvas, () => opts.onFirstTurn?.());

  // ---- pause while the hero is off-screen ----
  let visible = true;
  const io = new IntersectionObserver((entries) => {
    visible = entries[0]?.isIntersecting ?? true;
  });
  io.observe(canvas);

  // ---- loop ----
  const clock = new Clock();
  const jarBase = new Vector3();
  const camPos = new Vector3();
  const keyDir = new Vector3();
  const lookAt = new Vector3();
  let sp = opts.getProgress(); // smoothed progress
  let frames = 0;
  let canvasShown: boolean | null = null;
  let firstShown = false;
  let framesHidden = 0; // correct frames rendered since the reveal began, before showing
  let lifeT = 0; // the hold's clock (runs while the jar is at rest)
  let lastScroll = 0;
  let shownOpacity = -1;
  let sq = opts.getPans?.() ?? 0; // step 3, smoothed the same way
  let shifted = false;
  const onScroll = () => {
    lastScroll = performance.now();
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  const setDpr = (v: number) => {
    dpr = v;
    renderer.setPixelRatio(v);
    resize();
  };
  window.__pyoorHero = { p: sp, target: sp, frames };

  // one clock for the page: GSAP's ticker drives Lenis, ScrollTrigger and this render
  const frame = () => {
    // Unseen until step 2's reveal: the canvas is hidden (opacity and visibility) and nothing is
    // drawn to it, so no frame (shadow, ground, glow) can show behind the opening or panorama.
    // On the reveal's start: size to the viewport now, render one correct (masked) frame while
    // still hidden, and show the canvas on the next tick, so a stale frame can never flash.
    const shown = journeyStore.show3d;
    if (!shown && canvasShown !== false) {
      canvasShown = false;
      framesHidden = 0;
      canvas.style.opacity = '0';
      canvas.style.visibility = 'hidden';
    } else if (shown && canvasShown !== true && framesHidden > 0) {
      // (also when the scene was built after the reveal had passed: canvasShown is still null)
      canvasShown = true;
      canvas.style.opacity = '1';
      canvas.style.visibility = 'visible';
      journeyStore.onReady?.(); // a late arrival crossfades in from this frame
    }
    if (shown && !canvasShown && framesHidden === 0) resize();
    // Step 3: the crystal field gives way to the pans' colour fills, then the canvas is hidden
    // and draws nothing.
    const qGoal = opts.getPans?.() ?? 0;
    const fadeAt = (q: number) => smooth(PANS.colour[0] - 0.08, PANS.colour[0] + 0.06, q);
    const gone = fadeAt(qGoal) >= 1 && fadeAt(sq) >= 0.999;
    if (canvasShown) {
      const o = gone ? 0 : Math.round((1 - fadeAt(sq)) * 1000) / 1000;
      if (o !== shownOpacity) {
        shownOpacity = o;
        canvas.style.opacity = String(o);
        canvas.style.visibility = o > 0 ? 'visible' : 'hidden';
      }
    } else shownOpacity = -1;
    if (!visible || !shown || gone || journeyStore.covered || coveredStore.get()) {
      clock.getDelta(); // don't let time pile up while paused
      sq = qGoal;
      return;
    }
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = still ? 0 : clock.elapsedTime;
    const goal = opts.getProgress();
    sp += (goal - sp) * Math.min(1, dt * 7);
    if (Math.abs(goal - sp) < 1e-5) sp = goal; // settle exactly, so frames repeat exactly
    sq += (qGoal - sq) * Math.min(1, dt * 7);
    if (Math.abs(qGoal - sq) < 1e-5) sq = qGoal;
    const p = sp;
    // while the Journey lines its engraving up on the jar, the jar holds still
    const calm = journeyStore.calm;
    pointer.x += (target.x * (1 - calm) - pointer.x) * 0.05;
    pointer.y += (target.y * (1 - calm) - pointer.y) * 0.05;

    // The opening (components/opening): the sunrise from 30% of the screen height below, the
    // glide to 62%, the idle turn while at rest (it starts once the jar has begun to rise).
    const op = openingPose(openingStore.get());
    const rest = 1 - smooth(0.06, 0.11, p);
    turnCtl.update(dt, !!canvasShown && rest >= 0.999 && calm === 0 && !still);
    if (!still && rest >= 1 && op.rise > 0) lifeT += dt * turnCtl.sway;
    const turn = Math.sin((2 * Math.PI * lifeT) / TURN_PERIOD) * TURN * (1 - calm) * turnCtl.sway;
    // sharpness: up to 2 only on the hero's first screen once the page has rested 300 ms; from
    // the film on, the tier's DPR throughout (each switch reallocates the full-screen canvas,
    // which stalls a frame, so it never switches back and forth while scrolling)
    const resting = performance.now() - lastScroll > 300;
    const wantDpr = p < 0.02 ? (resting ? restDpr : dpr) : scrollDpr;
    if (dpr !== wantDpr) setDpr(wantDpr);
    // the view's height at the jar (the lens changes fov and distance together: the same height)
    const viewH = 2 * Math.tan((15 * Math.PI) / 180) * 0.62 * (layout.portrait ? 0.92 : 1);
    poseJar(
      rig,
      p,
      t,
      pointer,
      layout,
      {
        rise: op.rise,
        riseFrom: 0.3 * viewH,
        glide: op.glide,
        turn,
        yaw: turnCtl.yaw,
        tilt: turnCtl.tilt,
        flow: sim,
      },
      1 - calm,
    );
    poseCap(rig, p, layout, op.glide);
    lidRim.intensity = 2.2 * op.rise * rest;

    // the camera: the film's (lib/motion/film.ts)
    const fc = filmCamera(p, layout, camera.aspect, pourStore.shape(), op.glide);
    camera.position.set(fc.pos[0], fc.pos[1], fc.pos[2]);
    lookAt.set(fc.look[0], fc.look[1], fc.look[2]);
    camera.lookAt(lookAt);
    // phones: the subject centred in the 3D zone above the text (an image shift, eased in)
    if (fc.shift > 0) {
      const w = canvas.clientWidth || 1;
      const h = canvas.clientHeight || 1;
      camera.setViewOffset(w, h, 0, fc.shift * h, w, h);
      shifted = true;
    } else if (shifted) {
      camera.clearViewOffset();
      shifted = false;
    }
    camPos.copy(camera.position);
    pour.update(p, camPos, jarStartX(layout, op.glide));
    salt.update(p);

    // the key light: towards the cursor (desktop), a slow drift on touch; ±25°
    const lx = fine ? pointer.x * 2 : Math.sin(t * 0.22) * 0.8;
    const ly = fine ? pointer.y * 2 : Math.sin(t * 0.13 + 1) * 0.4;
    light.x += (lx - light.x) * 0.06;
    light.y += (ly - light.y) * 0.06;
    keyDir.copy(KEY_DIR).applyAxisAngle(Y_AXIS, -light.x * KEY_SWING);
    keyDir.y *= 1 - light.y * 0.25;
    key.position.copy(keyDir).add(rig.pivot.position);
    key.target.position.copy(rig.pivot.position);

    // Contact shadows: the jar's follows its base and fades as it lifts off to pour (and back
    // as it settles); the cap's as it lands; the mound's grows with it.
    rig.pivot.updateMatrixWorld(true);
    rig.jar.getWorldPosition(jarBase);
    ground.contact.position.set(jarBase.x, 0, jarBase.z);
    const lifted = 1 - smooth(0.002, 0.03, jarBase.y);
    // (all three fade in only with the 3D jar, as step 2 reveals it)
    const seen = journeyStore.reveal;
    for (const [mat, base] of ground.contactMats)
      mat.opacity = base * lifted * op.rise * op.rise * seen;
    const rest0 = capRest(jarStartX(layout, op.glide));
    capShadow.group.position.set(rest0[0] - R * 0.15, 0, rest0[2]);
    capShadow.set(smooth(0.25, 0.28, p) * 0.9 * seen);
    const poured = moundHeightAt(sim, p) / sim.mound.hEnd;
    moundShadow.group.position.set(pour.mx, 0, 0);
    const ms = 0.25 + 1.6 * poured;
    moundShadow.group.scale.set(ms, 1, ms);
    moundShadow.set(Math.min(1, poured * 1.4) * seen);
    ground.shadowMat.opacity = 0.12;
    renderer.setClearColor(SKY, 0);

    renderer.render(scene, camera);

    frames++;
    framesHidden = canvasShown ? 0 : framesHidden + 1;
    window.__pyoorHero = { p, target: goal, frames, box: jarBox(), shown: !!canvasShown };
    if (canvasShown && !firstShown) {
      firstShown = true;
      opts.onFirstFrame();
    }
  };
  // Compile every material before the first frame, in parallel where the driver supports it
  // (KHR_parallel_shader_compile), instead of blocking the page for ~0.2–0.7 s on first render.
  await nextFrame();
  pour.mound.visible = true; // compile it too
  await idle();
  // each link waits at most opts.linkWait for a pause (the jar is needed by the film)
  await precompile(renderer, scene, camera, signal, opts.linkWait ?? 250);
  // Warm-up, invisibly: renders to the canvas while it is still hidden (textures upload,
  // shadow maps build), cleared afterwards. Never to an offscreen target: three.js builds other
  // shader variants for one (no tone mapping, linear output), compiled synchronously, which is
  // exactly the freeze compileAsync above avoids.
  {
    await idle();
    const fc = filmCamera(0, layout, camera.aspect, pourStore.shape());
    camera.position.set(fc.pos[0], fc.pos[1], fc.pos[2]);
    camera.lookAt(fc.look[0], fc.look[1], fc.look[2]);
    // everything that only appears later (the mound) is drawn once here too, so its programs
    // and shadow pass are built now rather than mid-scroll
    pour.mound.visible = true;
    // One object per idle moment: without parallel compile (many phones, software GL) linking
    // every program in one render freezes the page for 1–2 s, which stalls scrolling.
    const mats = new Map<Material, boolean>();
    scene.traverse((o) => {
      const m = (o as Mesh).material;
      if (m) (Array.isArray(m) ? m : [m]).forEach((x) => mats.set(x, x.visible));
    });
    for (const m of mats.keys()) {
      if (signal.aborted) break;
      mats.forEach((_, x) => (x.visible = x === m));
      renderer.render(scene, camera);
      await idle();
    }
    mats.forEach((v, x) => (x.visible = v));
    pour.mound.visible = true;
    renderer.render(scene, camera);
    renderer.clear(); // the canvas never shows a warm-up frame
    pour.mound.visible = false;
  }
  if (signal.aborted) {
    disposeObject(scene);
    envRT.dispose();
    pmrem.dispose();
    renderer.dispose();
    throw new DOMException('Aborted', 'AbortError');
  }
  const { gsap } = await loadGsap();
  gsap.ticker.add(frame);
  journeyStore.ready3d = true;
  // the products' plates (the lake's opening) may start building now, in calm moments
  const w = window as Window & { __pyoorLakeArmed?: boolean };
  if (!w.__pyoorLakeArmed) {
    w.__pyoorLakeArmed = true;
    window.dispatchEvent(new Event('pyoor:lake-arm'));
  }

  heroShare.set({
    jar: rig.jar,
    lid: rig.lid,
    camera,
    canvas,
    frame: look.frame,
    label: () => look.label.map,
    maxTextureSize: renderer.capabilities.maxTextureSize,
    maxAnisotropy,
    weak,
  });

  // The label at 4096 px (all tiers): decoded off the main thread, uploaded in an idle moment
  // while the page rests (never mid-scroll), then swapped in (same program: no recompile).
  void (async () => {
    try {
      const loader = new ImageBitmapLoader();
      loader.setOptions({ imageOrientation: 'none', colorSpaceConversion: 'none' });
      const bitmap = await loader.loadAsync(asset(LABEL_4K));
      if (signal.aborted) return bitmap.close?.();
      const tex = new Texture(bitmap as unknown as HTMLImageElement);
      tex.flipY = false;
      tex.colorSpace = SRGBColorSpace;
      tex.anisotropy = maxAnisotropy;
      tex.minFilter = LinearMipmapLinearFilter;
      tex.generateMipmaps = true;
      if (glbLabel) {
        tex.wrapS = glbLabel.wrapS;
        tex.wrapT = glbLabel.wrapT;
        tex.offset.copy(glbLabel.offset);
        tex.repeat.copy(glbLabel.repeat);
        tex.channel = glbLabel.channel;
      }
      tex.needsUpdate = true;
      while (!signal.aborted && performance.now() - lastScroll < 300) await idle();
      await idle();
      if (signal.aborted) return tex.dispose();
      renderer.initTexture(tex);
      label4k = tex;
      look.label.map = tex;
      glbLabel?.dispose();
    } catch {
      // the model's own 2400 px label stays
    }
  })();

  return {
    dispose() {
      gsap.ticker.remove(frame);
      journeyStore.ready3d = false;
      heroShare.set(null);
      window.removeEventListener('scroll', onScroll);
      look.dispose();
      label4k?.dispose();
      ro.disconnect();
      window.visualViewport?.removeEventListener('resize', resize);
      io.disconnect();
      window.removeEventListener('pointermove', onPointer);
      turnCtl.dispose();
      pour.dispose();
      salt.dispose();
      disposeObject(scene);
      envRT.dispose();
      pmrem.dispose();
      renderer.dispose();
      delete window.__pyoorHero;
    },
  };
}
