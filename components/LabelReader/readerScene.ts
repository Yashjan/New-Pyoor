import {
  ACESFilmicToneMapping,
  BufferAttribute,
  BufferGeometry,
  Color,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  Group,
  HemisphereLight,
  ImageBitmapLoader,
  LinearMipmapLinearFilter,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  OrthographicCamera,
  PlaneGeometry,
  PMREMGenerator,
  Quaternion,
  Scene,
  SRGBColorSpace,
  Texture,
  Vector3,
  WebGLRenderer,
  type Object3D,
  type PerspectiveCamera,
} from 'three';
import { studioEnvironment } from '@/components/hero/scene/studio';
import type { HeroShare } from '@/lib/three/heroShare';
import { asset } from '@/lib/basePath';

/**
 * The label reader's 3D (components/LabelReader): its own small renderer over the page, so the
 * hero's scene, materials and scroll timeline are never touched. The jar is the hero's (cloned:
 * same geometry and materials), starting exactly where the hero shows it; the label is a new
 * sheet with the label's own geometry, which a vertex shader unrolls off the cylinder.
 *
 * `state` (0–1 each) is driven by the reader's GSAP timeline:
 *   face    the jar turns its label to the camera and comes closer
 *   unroll  the label rolls out from the front into a flat sheet (radius r → ∞), bending a
 *           little as it moves
 *   fit     the sheet moves to its reading place and size; the jar fades to 0.15
 * `view` (zoom 1–4, pan in px) is the reader's gesture target; it is eased towards each frame.
 */
export interface Reader {
  state: { face: number; unroll: number; fit: number };
  view: { zoom: number; x: number; y: number };
  /** where the sheet is read: the reading area's client rect */
  setArea(r: DOMRect): void;
  /** the canvas's client rect (the hero canvas's: the jar lines up with the hero's) */
  setViewport(r: DOMRect): void;
  /** the fitted sheet's size in px at zoom 1 (for the pan limits) */
  sheetPx(): { w: number; h: number };
  render(): void;
  dispose(): void;
}

const IVORY = new Color('#f5f1e8');
const COLS = 256;
const ROWS = 24;

export async function createReader(
  canvas: HTMLCanvasElement,
  share: HeroShare,
  hd: boolean,
): Promise<Reader> {
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.debug.checkShaderErrors = false;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.autoClear = false;
  renderer.setClearColor(IVORY, 0);

  const scene = new Scene();
  const pmrem = new PMREMGenerator(renderer);
  const envRT = studioEnvironment(pmrem);
  scene.environment = envRT.texture;
  const key = new DirectionalLight(0xfff0dc, 2.4);
  key.position.set(0.6, 1.2, 0.8);
  const rim = new DirectionalLight(0xe9c98a, 1.2);
  rim.position.set(-0.8, 0.5, -0.6);
  scene.add(key, rim, new HemisphereLight(0xffffff, 0xe8dfcd, 0.35));

  const camera = (share.camera as PerspectiveCamera).clone();

  // ---- the jar: the hero's, at the hero's pose (the cap on, at rest: its matrix is the jar's) ----
  const holder = new Group();
  holder.matrixAutoUpdate = false;
  share.jar.updateMatrixWorld(true);
  const pose0 = new Matrix4().copy(share.jar.matrixWorld);
  const jar = share.jar.clone(true);
  jar.position.set(0, 0, 0);
  jar.rotation.set(0, 0, 0);
  jar.scale.set(1, 1, 1);
  const lid = share.lid.clone(true);
  lid.matrix.identity();
  lid.matrixAutoUpdate = false;
  jar.add(lid);
  const lips: Object3D[] = [];
  let saltMat: Mesh['material'] | null = null;
  jar.traverse((o) => {
    if (o.name === 'Label') o.visible = false; // the sheet stands in for it
    if (o.name === 'Label_lip') lips.push(o);
    if (o.name === 'Salt') saltMat = (o as Mesh).material;
  });
  // the model has no salt behind the label (it was never seen): a core of the same salt, so
  // the jar stays full once the label has rolled off
  const f0 = share.frame;
  const coreGeo = new CylinderGeometry(
    f0.r - 0.0018,
    f0.r - 0.0018,
    f0.y1 - f0.y0 + 0.004,
    96,
    1,
    true,
  );
  const core = new Mesh(coreGeo, saltMat ?? new MeshBasicMaterial({ color: 0x4a3a33 }));
  core.position.y = (f0.y0 + f0.y1) / 2;
  jar.add(core);
  holder.add(jar);
  scene.add(holder);

  // ---- the sheet: the label's own cylinder, as a grid the shader can unroll ----
  const f = share.frame;
  const geo = new BufferGeometry();
  const n = (COLS + 1) * (ROWS + 1);
  const pos = new Float32Array(n * 3);
  const uv = new Float32Array(n * 2);
  const arc = new Float32Array(n);
  for (let j = 0, k = 0; j <= ROWS; j++) {
    const y = f.y1 - ((f.y1 - f.y0) * j) / ROWS;
    for (let i = 0; i <= COLS; i++, k++) {
      const th = f.th0 + ((f.th1 - f.th0) * i) / COLS;
      pos.set([f.r * Math.sin(th), y, f.r * Math.cos(th)], k * 3);
      uv.set([f.a * th + f.b, j / ROWS], k * 2);
      arc[k] = f.r * th;
    }
  }
  const idx: number[] = [];
  for (let j = 0; j < ROWS; j++)
    for (let i = 0; i < COLS; i++) {
      const a = j * (COLS + 1) + i;
      const b = a + COLS + 1;
      idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
  geo.setAttribute('position', new BufferAttribute(pos, 3));
  geo.setAttribute('uv', new BufferAttribute(uv, 2));
  geo.setAttribute('aS', new BufferAttribute(arc, 1));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const s0 = f.r * f.th0;
  const s1 = f.r * f.th1;
  const sheetW = s1 - s0;
  const sheetH = f.y1 - f.y0;
  /** the flat sheet's centre, in its own frame */
  const centre = new Vector3((s0 + s1) / 2, (f.y0 + f.y1) / 2, f.r);

  const heroTex = share.label();
  const tex = new Texture(heroTex?.image);
  const prep = (t: Texture) => {
    t.flipY = false;
    t.colorSpace = SRGBColorSpace;
    t.anisotropy = share.maxAnisotropy;
    t.minFilter = LinearMipmapLinearFilter;
    t.generateMipmaps = true;
    t.needsUpdate = true;
    return t;
  };
  prep(tex);
  const uniforms = {
    uUnroll: { value: 0 },
    uR: { value: f.r },
    uHalf: { value: sheetW / 2 },
    uBend: { value: 0.012 },
    uFlat: { value: 0 },
  };
  const mat = new MeshPhysicalMaterial({
    map: tex,
    roughness: 0.42,
    metalness: 0,
    clearcoat: share.weak ? 0 : 0.15,
    clearcoatRoughness: 0.3,
    side: DoubleSide,
  });
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        attribute float aS;
        uniform float uUnroll, uR, uHalf, uBend;`,
      )
      .replace(
        '#include <beginnormal_vertex>',
        `vec3 pyP; vec3 objectNormal;
        {
          float k = clamp(uUnroll, 0.0, 1.0);
          if (k < 0.9995) {
            // a cylinder through the front line, its radius growing to infinity
            float Rk = uR / (1.0 - k);
            float phi = aS / Rk;
            pyP = vec3(Rk * sin(phi), position.y, uR - Rk + Rk * cos(phi));
            objectNormal = vec3(sin(phi), 0.0, cos(phi));
          } else {
            pyP = vec3(aS, position.y, uR);
            objectNormal = vec3(0.0, 0.0, 1.0);
          }
          // paper: the free ends lag a little while it moves, and settle flat
          float e = aS / uHalf;
          pyP.z += sin(3.14159265 * k) * uBend * e * e;
        }
        #ifdef USE_TANGENT
          vec3 objectTangent = vec3( tangent.xyz );
        #endif`,
      )
      .replace('#include <begin_vertex>', 'vec3 transformed = pyP;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uFlat;\nvec3 pyAlbedo;')
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
        pyAlbedo = diffuseColor.rgb;
        if (!gl_FrontFacing) diffuseColor.rgb = vec3(0.86, 0.85, 0.82); // the label's back`,
      )
      .replace(
        '#include <tonemapping_fragment>',
        // once it is read flat: the print's own colours, no sheen or tone curve
        `#include <tonemapping_fragment>
        if (gl_FrontFacing) gl_FragColor.rgb = mix(gl_FragColor.rgb, pyAlbedo, uFlat);`,
      );
  };
  mat.customProgramCacheKey = () => 'py-label-sheet';
  const sheet = new Mesh(geo, mat);
  sheet.frustumCulled = false;
  sheet.matrixAutoUpdate = false;
  scene.add(sheet);

  // ---- the veil that fades the jar to 0.15 (over the jar, under the sheet) ----
  const veilScene = new Scene();
  const veilMat = new MeshBasicMaterial({
    color: IVORY,
    transparent: true,
    opacity: 0,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
  veilScene.add(new Mesh(new PlaneGeometry(2, 2), veilMat));
  const ortho = new OrthographicCamera(-1, 1, 1, -1, 0, 1);

  // ---- the 8K label, only now (desktop with the GPU for it), else the 4K ----
  let hdTex: Texture | null = null;
  let disposed = false;
  const size = hd && share.maxTextureSize >= 8192 ? 8192 : 4096;
  void new ImageBitmapLoader()
    .setOptions({ imageOrientation: 'none', colorSpaceConversion: 'none' })
    .loadAsync(asset(`/textures/label-herbal-black-salt-${size}.webp`))
    .then((bitmap) => {
      if (disposed) return;
      hdTex = prep(new Texture(bitmap as unknown as HTMLImageElement));
      renderer.initTexture(hdTex);
      mat.map = hdTex;
    })
    .catch(() => {});

  // ---- layout ----
  let vp = new DOMRect(0, 0, 1, 1);
  let area = new DOMRect(0, 0, 1, 1);
  const setViewport = (r: DOMRect) => {
    vp = r;
    renderer.setSize(Math.max(1, r.width), Math.max(1, r.height), false);
    camera.aspect = r.width / Math.max(1, r.height);
    camera.updateProjectionMatrix();
  };

  const state = { face: 0, unroll: 0, fit: 0 };
  const view = { zoom: 1, x: 0, y: 0 };
  const cur = { zoom: 1, x: 0, y: 0 };
  const tan = () => Math.tan((camera.fov * Math.PI) / 360);
  /** the sheet's width in px at zoom 1: as large as fits the area */
  const fitPx = () => {
    const w = Math.min(area.width, (area.height * sheetW) / sheetH);
    return { w, h: (w * sheetH) / sheetW };
  };
  /** a client point at depth d (along the camera's view) as a world point */
  const fwd = new Vector3();
  const ray = new Vector3();
  const at = (x: number, y: number, d: number, out: Vector3) => {
    const nx = ((x - vp.left) / vp.width) * 2 - 1;
    const ny = -(((y - vp.top) / vp.height) * 2 - 1);
    ray.set(nx, ny, 0.5).unproject(camera).sub(camera.position).normalize();
    camera.getWorldDirection(fwd);
    return out.copy(camera.position).addScaledVector(ray, d / ray.dot(fwd));
  };

  // ---- poses ----
  const p0 = new Vector3();
  const q0 = new Quaternion();
  const sc0 = new Vector3();
  pose0.decompose(p0, q0, sc0);
  const pT = new Vector3();
  const qT = new Quaternion();
  const jp = new Vector3();
  const jq = new Quaternion();
  const one = new Vector3(1, 1, 1);
  const jarM = new Matrix4();
  const c0 = new Vector3();
  const c1 = new Vector3();
  const cq = new Quaternion();
  const off = new Vector3();
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  const yAxis = new Vector3(0, 1, 0);

  const render = () => {
    // ease the view towards the gestures' target
    cur.zoom = lerp(cur.zoom, view.zoom, 0.2);
    cur.x = lerp(cur.x, view.x, 0.2);
    cur.y = lerp(cur.y, view.y, 0.2);

    camera.updateMatrixWorld();
    // the jar: from the hero's pose, turned to face the camera, over the reading area's centre
    // (as tall as 70% of the area: closer on desktop, a little further on a phone's short area)
    const dJar = (0.122 * vp.height) / (2 * tan() * area.height * 0.7);
    at(area.left + area.width / 2, area.top + area.height * 0.55, dJar, pT);
    pT.y -= 0.06; // the jar's base below the centre
    const dir = off.copy(camera.position).sub(pT);
    qT.setFromAxisAngle(yAxis, Math.atan2(dir.x, dir.z));
    const e = state.face;
    jp.lerpVectors(p0, pT, e);
    jq.slerpQuaternions(q0, qT, e);
    jarM.compose(jp, jq, one);
    holder.matrix.copy(jarM);
    holder.matrixWorldNeedsUpdate = true;
    lips.forEach((l) => (l.visible = state.unroll < 0.02));

    // the sheet: on the jar, then (fit) at its reading place, facing the camera
    uniforms.uUnroll.value = state.unroll;
    uniforms.uFlat.value = 0.85 * state.fit;
    const { w } = fitPx();
    const z = 1 + (cur.zoom - 1) * state.fit;
    const d = (sheetW * vp.height) / (2 * tan() * w * z);
    c0.copy(centre).applyMatrix4(jarM);
    at(
      area.left + area.width / 2 + cur.x * state.fit,
      area.top + area.height / 2 + cur.y * state.fit,
      d,
      c1,
    );
    const t = state.fit;
    c0.lerp(c1, t);
    cq.slerpQuaternions(jq, camera.quaternion, t);
    // position = centre − q·(local centre)
    off.copy(centre).applyQuaternion(cq);
    sheet.matrix.compose(c0.sub(off), cq, one);
    sheet.matrixWorldNeedsUpdate = true;
    veilMat.opacity = 0.85 * state.fit;

    renderer.clear();
    sheet.visible = false;
    renderer.render(scene, camera);
    if (veilMat.opacity > 0.001) renderer.render(veilScene, ortho);
    sheet.visible = true;
    holder.visible = false;
    // flat, the sheet is in front of the jar: from then on it draws over it (it moves back to
    // its reading distance, which can be further than the jar)
    const flat = state.unroll >= 0.999;
    if (flat) {
      renderer.clearDepth();
      // and it stays inside the reading area (zoomed, it never runs under the text)
      renderer.setScissor(
        area.left - vp.left,
        vp.height - (area.bottom - vp.top),
        area.width,
        area.height,
      );
      renderer.setScissorTest(true);
    }
    renderer.render(scene, camera);
    if (flat) renderer.setScissorTest(false);
    holder.visible = true;
  };

  // build every program now (in parallel where the driver can), before the first frame
  try {
    await renderer.compileAsync(scene, camera);
  } catch {
    // compiled on the first render instead
  }

  return {
    state,
    view,
    setArea: (r) => (area = r),
    setViewport,
    sheetPx: fitPx,
    render,
    dispose() {
      disposed = true;
      geo.dispose();
      coreGeo.dispose();
      mat.dispose();
      tex.dispose();
      hdTex?.dispose();
      veilMat.dispose();
      envRT.dispose();
      pmrem.dispose();
      renderer.dispose();
      (hdTex?.image as ImageBitmap | undefined)?.close?.();
    },
  };
}
