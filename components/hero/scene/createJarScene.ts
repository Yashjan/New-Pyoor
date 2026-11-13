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
  WebGLRenderTarget,
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
import { cameraAt } from './camera';
import { loadGsap } from '@/lib/motion/gsap';
import { createPour, type Pour } from './grains';
import { createContact, createGround } from './ground';
import { createJarRig, poseCap, poseJar } from './jar';
import { FLIGHT, capRest, pouredAt, R } from '@/lib/motion/pour';
import { FOV, jarStartX } from '@/lib/motion/heroCamera';
import { layoutFor, type HeroLayout } from './layout';
import { smooth } from './math';
import { PANS, power2InOut, riseCamera, span } from '@/lib/motion/pans';
import { createTurn } from './turn';

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
  /** Step 3's progress, 0–1 (lib/motion/pans.ts): its first part is the camera's rise. */
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
/** The label at print sharpness (tools/3d/label_textures.py), loaded after the first frame. */
const LABEL_4K = '/textures/label-herbal-black-salt-4096.webp';

const idle = () =>
  new Promise<void>((resolve) =>
    window.requestIdleCallback
      ? window.requestIdleCallback(() => resolve(), { timeout: 500 })
      : window.setTimeout(resolve, 16),
  );
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
  // No error log reads: getProgramInfoLog waits for the compile, which turns the parallel
  // (KHR_parallel_shader_compile) compile back into a ~1–2 s freeze of the page.
  renderer.debug.checkShaderErrors = false;
  renderer.setClearColor(SKY, 0);
  // DPR: the tier's cap while scrolling; up to 2 once the page has rested for 300 ms
  const scrollDpr = Math.min(window.devicePixelRatio, tier.maxDpr);
  const restDpr = tier.name === 'weak' ? scrollDpr : Math.min(window.devicePixelRatio, 2);
  let dpr = scrollDpr;
  renderer.setPixelRatio(dpr);
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.shadowMap.enabled = tier.shadows;
  renderer.shadowMap.type = PCFSoftShadowMap;

  const scene = new Scene();
  const fogColor = IVORY.clone();
  scene.fog = new Fog(fogColor, 2.2, 9);
  const pmrem = new PMREMGenerator(renderer);
  const envRT = studioEnvironment(pmrem);
  scene.environment = envRT.texture;

  const camera = new PerspectiveCamera(FOV, 1, 0.01, 40);
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
  const hemi = new HemisphereLight(0xffffff, 0xe8dfcd, 0.35);
  // The pour's dusk light: low, warm, from the upper right, so falling grains catch glints.
  const dusk = new DirectionalLight(0xffc27a, 1.5);
  dusk.position.set(0.9, 0.28, 0.5);
  scene.add(key, rim, lidRim, hemi, dusk);

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
  try {
    gltf = await modelLoad;
  } catch (err) {
    renderer.dispose();
    pmrem.dispose();
    envRT.dispose();
    throw err;
  }
  const rig = createJarRig(gltf.scene);
  const lidBottom = new Box3().setFromObject(rig.lid).min.y;
  scene.add(rig.pivot, rig.lid);
  const look = dressJar(rig, tier.name !== 'weak', lidBottom);
  const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();
  const glbLabel = look.label.map;
  if (glbLabel) glbLabel.anisotropy = maxAnisotropy;
  let label4k: Texture | null = null;
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

  // the pour: twice the old count, capped by the tier (precomputed, deterministic)
  let layout: HeroLayout = layoutFor(canvas.clientWidth || 1, canvas.clientHeight || 1);
  let pour: Pour = createPour(tier.grains, jarStartX(layout), tier.shadows);
  const addPour = () => scene.add(pour.grains, pour.dust, pour.mound);
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
      // the jar starts elsewhere, so the pour (and its mound) is rebuilt from there
      scene.remove(pour.grains, pour.dust, pour.mound);
      pour.dispose();
      pour = createPour(tier.grains, jarStartX(next), tier.shadows);
      addPour();
    }
    layout = next;
  };
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  // phones: the address bar showing/hiding (sized before the next frame, never after it)
  window.visualViewport?.addEventListener('resize', resize);
  resize();

  // ---- pointer parallax (only matters while the jar is at rest) ----
  const pointer = { x: 0, y: 0 };
  const target = { x: 0, y: 0 };
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
  let sp = opts.getProgress(); // smoothed progress
  const riseAt = () => span(opts.getPans?.() ?? 0, PANS.rise);
  let sr = riseAt(); // the rise (step 3), smoothed the same way
  let shownOpacity = -1;
  let frames = 0;
  let canvasShown: boolean | null = null;
  let firstShown = false;
  let framesHidden = 0; // correct frames rendered since the reveal began, before showing
  let lifeT = 0; // the hold's clock (runs while the jar is at rest)
  let lastScroll = 0;
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
    // Paused behind the panorama, but the first frame renders anyway (invisible there): the
    // textures upload and the pipelines warm up during the Journey, not at the reveal.
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
    // Step 3: the canvas fades over the rise's last quarter, then is hidden and draws nothing
    // (the pans' SVG has taken over, its far edge exactly on this horizon line).
    const riseGoal = riseAt();
    const gone = riseGoal >= 1 && sr >= 0.999;
    if (canvasShown) {
      const o = gone ? 0 : Math.round((1 - smooth(0.75, 1, sr)) * 1000) / 1000;
      if (o !== shownOpacity) {
        shownOpacity = o;
        canvas.style.opacity = String(o);
        canvas.style.visibility = o > 0 ? 'visible' : 'hidden';
      }
    } else shownOpacity = -1;
    if (!visible || !shown || gone || journeyStore.covered || coveredStore.get()) {
      clock.getDelta(); // don't let time pile up while paused
      return;
    }
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = still ? 0 : clock.elapsedTime;
    const goal = opts.getProgress();
    sp += (goal - sp) * Math.min(1, dt * 7);
    if (Math.abs(goal - sp) < 1e-5) sp = goal; // settle exactly, so frames repeat exactly
    const p = sp;
    sr += (riseGoal - sr) * Math.min(1, dt * 7);
    if (Math.abs(riseGoal - sr) < 1e-5) sr = riseGoal;
    // the rise: the jar drifts out left and the cap right, faster as the camera climbs
    const drift = 1.5 * sr * sr;
    // while the Journey lines its engraving up on the jar, the jar holds still
    const calm = journeyStore.calm;
    pointer.x += (target.x * (1 - calm) - pointer.x) * 0.05;
    pointer.y += (target.y * (1 - calm) - pointer.y) * 0.05;

    // The opening (components/opening): the sunrise from 30% of the screen height below, the
    // glide to 62%, the idle turn while at rest (it starts once the jar has begun to rise).
    const op = openingPose(openingStore.get());
    const rest = 1 - smooth(0.02, 0.14, p);
    turnCtl.update(dt, !!canvasShown && rest >= 0.999 && calm === 0 && !still);
    if (!still && rest >= 1 && op.rise > 0) lifeT += dt * turnCtl.sway;
    const turn = Math.sin((2 * Math.PI * lifeT) / TURN_PERIOD) * TURN * (1 - calm) * turnCtl.sway;
    // sharpness: the tier's DPR while scrolling, up to 2 once the page has rested 300 ms
    const resting = performance.now() - lastScroll > 300;
    if (resting && dpr !== restDpr) setDpr(restDpr);
    else if (!resting && dpr !== scrollDpr) setDpr(scrollDpr);
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
      },
      1 - calm,
    );
    poseCap(rig, p, layout, op.glide);
    if (drift) {
      rig.pivot.position.x -= drift;
      rig.lid.matrix.elements[12] += drift;
    }
    lidRim.intensity = 2.2 * op.rise * rest;
    pour.update(p);

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
    capShadow.group.position.set(rest0[0] - R * 0.15 + drift, 0, rest0[2]);
    capShadow.set(smooth(0.2, 0.25, p) * 0.9 * seen);
    const poured = pouredAt(p - FLIGHT);
    moundShadow.group.position.set(pour.mx, 0, 0);
    const ms = 0.25 + 1.15 * Math.cbrt(poured);
    moundShadow.group.scale.set(ms, 1, ms);
    moundShadow.set(Math.sqrt(poured) * seen);
    ground.shadowMat.opacity = 0.12;
    renderer.setClearColor(SKY, 0);

    if (sr > 0) {
      // step 3: the camera cranes up over the mound (lib/motion/pans.ts)
      const { pos, look } = riseCamera(power2InOut(sr), layout, pour.mx);
      camera.position.set(pos[0], pos[1], pos[2]);
      camera.lookAt(look[0], look[1], look[2]);
    } else cameraAt(camera, p, layout, op.glide);
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
  try {
    await renderer.compileAsync(scene, camera);
  } catch {
    // older drivers: the render below compiles them instead
  }
  // Warm-up, invisibly: one render into an offscreen target (textures upload, pipelines and
  // shadow maps build), never to the visible canvas.
  {
    const w = Math.max(2, renderer.domElement.width);
    const h = Math.max(2, renderer.domElement.height);
    await idle();
    const warm = new WebGLRenderTarget(w, h);
    cameraAt(camera, 0, layout, 1);
    // everything that only appears later (the mound) is drawn once here too, so its programs
    // and shadow pass are built now rather than mid-scroll
    pour.mound.visible = true;
    renderer.setRenderTarget(warm);
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
    renderer.setRenderTarget(null);
    renderer.clear(); // the visible canvas never holds a warm-up frame
    pour.mound.visible = false;
    warm.dispose();
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

  heroShare.set({
    jar: rig.jar,
    lid: rig.lid,
    camera,
    canvas,
    frame: look.frame,
    label: () => look.label.map,
    maxTextureSize: renderer.capabilities.maxTextureSize,
    maxAnisotropy,
    weak: tier.name === 'weak',
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
      disposeObject(scene);
      envRT.dispose();
      pmrem.dispose();
      renderer.dispose();
      delete window.__pyoorHero;
    },
  };
}
