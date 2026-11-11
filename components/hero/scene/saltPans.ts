import {
  BackSide,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  HalfFloatType,
  InstancedMesh,
  LinearFilter,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  PerspectiveCamera,
  PlaneGeometry,
  RepeatWrapping,
  ShaderMaterial,
  SphereGeometry,
  Vector3,
  WebGLRenderTarget,
  type Scene,
  type WebGLRenderer,
} from 'three';
import { clamp01, createRng, smooth } from './math';

/**
 * The end of the jar sequence: Sambhar's salt pans. Shallow, mirror-like brine, rows of white
 * conical salt mounds (instanced) separated by low bunds, and a sky that warms as the brine
 * blushes pink. Scene scale is 1:10, so the camera's 0.12 is a 1.2 m eye height.
 * Pure function of progress p, like the rest of the sequence, so it reverses exactly.
 */

/** Everything the reflection pass renders is on this layer. */
export const REFLECT_LAYER = 1;

const WHITE_WATER = new Color('#e9e4dc');
const PINK_NEAR = new Color('#e7a6a0');
const PINK_FAR = new Color('#c9706c');
/** Not pure white: the lit side lands near white, the shaded side keeps its form. */
const MOUND_ALBEDO = 0xa9a6a1;
const SKY_TOP_WHITE = new Color('#f4f0e7');
const SKY_HOR_WHITE = new Color('#eee9df');
const SKY_TOP_PINK = new Color('#f7e7d9');
const SKY_HOR_PINK = new Color('#efbfa8');

/** x, z, size. Loose rows that widen with distance; the centre stays open for the camera. */
const MOUNDS: readonly (readonly [number, number, number])[] = [
  [-0.46, -1.3, 1.02],
  [0.52, -1.42, 0.92],
  [-1.02, -2.35, 1.0],
  [-0.2, -2.55, 0.86],
  [0.74, -2.4, 1.08],
  [-1.62, -3.6, 0.94],
  [-0.62, -3.75, 1.1],
  [0.34, -3.55, 0.96],
  [1.32, -3.7, 1.04],
  [-2.3, -5.0, 1.06],
  [-1.14, -5.15, 0.92],
  [0.06, -4.95, 1.12],
  [1.08, -5.2, 0.98],
  [2.2, -5.05, 1.02],
  [-3.1, -6.5, 1.0],
  [-1.76, -6.7, 1.1],
  [-0.5, -6.45, 0.96],
  [0.82, -6.65, 1.08],
  [2.08, -6.5, 0.94],
  [3.3, -6.7, 1.05],
];

/** Bund lines: across the view (z) and running away from it (x). */
const BUNDS_Z = [-1.85, -3.0, -4.3, -5.85, -7.7];
const BUNDS_X = [-3.9, -2.65, -1.5, -0.86, 0.9, 1.72, 2.8, 4.1];

/** A cone of piled salt: a noisy, slightly concave profile, rougher towards the top. */
function moundGeometry(seed: number): BufferGeometry {
  const { rnd } = createRng(seed);
  const RINGS = 18;
  const SEGS = 40;
  const R = 0.17;
  const H = 0.15 + rnd() * 0.035;
  const waves = Array.from({ length: 7 }, (_, i) => ({
    k: 2 + i * 2 + Math.floor(rnd() * 3),
    phase: rnd() * 6.28,
    w: 3 + rnd() * 9,
    amp: 0.5 / (1 + i * 0.45),
  }));
  const pos: number[] = [];
  const col: number[] = [];
  const uv: number[] = [];
  const index: number[] = [];
  for (let j = 0; j <= RINGS; j++) {
    const v = j / RINGS; // 0 apex, 1 base
    for (let i = 0; i < SEGS; i++) {
      const a = (i / SEGS) * Math.PI * 2;
      let n = 0;
      for (const w of waves) n += w.amp * Math.sin(w.k * a + w.phase + v * w.w);
      const top = 1 - v;
      const r = R * Math.pow(v, 0.94) * (1 + n * (0.05 + 0.1 * top * v * 4));
      const y = H * (1 - Math.pow(v, 0.88)) * (1 + n * 0.035 * v);
      pos.push(Math.cos(a) * r, y, Math.sin(a) * r);
      // damp at the waterline, clean white above it
      const wet = smooth(0.82, 1, v);
      col.push(1 - wet * 0.1, 1 - wet * 0.13, 1 - wet * 0.17);
      uv.push((i / SEGS) * 5, v * 2.5);
    }
  }
  for (let j = 0; j < RINGS; j++) {
    for (let i = 0; i < SEGS; i++) {
      const a = j * SEGS + i;
      const b = j * SEGS + ((i + 1) % SEGS);
      const c = a + SEGS;
      const d = b + SEGS;
      index.push(a, b, c, b, d, c);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute('color', new BufferAttribute(new Float32Array(col), 3));
  g.setAttribute('uv', new BufferAttribute(new Float32Array(uv), 2));
  g.setIndex(index);
  g.computeVertexNormals();
  return g;
}

/** A low earth ridge, one unit long along x, half-ellipse in section. */
function bundGeometry(): BufferGeometry {
  const N = 8;
  const pos: number[] = [];
  const index: number[] = [];
  for (let s = 0; s <= 1; s++) {
    for (let i = 0; i <= N; i++) {
      const a = Math.PI - (i / N) * Math.PI;
      pos.push(s - 0.5, Math.sin(a), Math.cos(a) * 0.5);
    }
  }
  for (let i = 0; i < N; i++) {
    const a = i;
    const b = i + 1;
    const c = i + N + 1;
    const d = i + N + 2;
    index.push(a, c, b, b, c, d);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  g.setIndex(index);
  g.computeVertexNormals();
  return g;
}

/** Fine crystalline grain for the mounds' surface. */
function grainTexture(): CanvasTexture {
  const S = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = S;
  const g = canvas.getContext('2d')!;
  const img = g.createImageData(S, S);
  const { rnd } = createRng(41);
  for (let i = 0; i < S * S * 4; i += 4) {
    const v = 90 + rnd() * rnd() * 165;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new CanvasTexture(canvas);
  t.wrapS = t.wrapT = RepeatWrapping;
  return t;
}

const WATER_VERT = /* glsl */ `
  uniform mat4 uTexMat;
  varying vec3 vWorld;
  varying vec4 vRefl;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = w.xyz;
    vRefl = uTexMat * w;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

const WATER_FRAG = /* glsl */ `
  uniform sampler2D uRefl;
  uniform float uHasRefl, uPink, uFade;
  uniform vec3 uWhite, uNear, uFar, uSky;
  uniform float uBx[BX];
  uniform float uBz[BZ];
  varying vec3 vWorld;
  varying vec4 vRefl;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x),
               mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
  }

  void main() {
    vec3 toCam = cameraPosition - vWorld;
    float d = length(toCam.xz);
    float far = smoothstep(0.8, 9.0, d);
    // each pan is at its own salinity, so each blushes a little differently
    float ci = 0.0, cj = 0.0;
    for (int i = 0; i < BX; i++) if (vWorld.x > uBx[i]) ci += 1.0;
    for (int i = 0; i < BZ; i++) if (vWorld.z < uBz[i]) cj += 1.0;
    float pan = hash(vec2(ci, cj) + 3.7);
    float pk = clamp(uPink * (0.82 + 0.36 * pan), 0.0, 1.0);
    vec3 col = mix(uWhite, mix(uNear, uFar, far), pk);
    // the crust showing through shallow water
    float m = noise(vWorld.xz * 3.1) * 0.6 + noise(vWorld.xz * 11.0) * 0.4;
    col *= 0.975 + 0.05 * m * (1.0 - far);
    // a glossy sheen towards the horizon
    float grazing = pow(1.0 - clamp(toCam.y / length(toCam), 0.0, 1.0), 4.0);
    col = mix(col, uSky, 0.16 * grazing * (1.0 - 0.75 * pk));
    if (uHasRefl > 0.5) {
      vec2 uv = vRefl.xy / vRefl.w;
      uv += (vec2(noise(vWorld.xz * 16.0), noise(vWorld.zx * 19.0)) - 0.5) * 0.006 * (1.0 - far);
      vec4 r = texture2D(uRefl, uv);
      vec3 tint = mix(vec3(1.0), mix(uNear, vec3(1.0), 0.45), pk);
      col = mix(col, r.rgb * tint, r.a * mix(0.42, 0.82, grazing));
    }
    gl_FragColor = vec4(col, uFade);
    #include <colorspace_fragment>
    gl_FragColor.rgb += (hash(gl_FragCoord.xy) + hash(gl_FragCoord.yx + 9.0) - 1.0) / 255.0;
  }
`;

const SKY_VERT = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    vec4 p = projectionMatrix * mat4(mat3(viewMatrix)) * vec4(position, 1.0);
    gl_Position = p.xyww;
  }
`;

const SKY_FRAG = /* glsl */ `
  uniform vec3 uTop, uHor;
  uniform float uFade;
  varying vec3 vDir;
  void main() {
    gl_FragColor = vec4(mix(uHor, uTop, smoothstep(0.0, 0.3, normalize(vDir).y)), uFade);
    #include <colorspace_fragment>
    float n = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
    float m = fract(sin(dot(gl_FragCoord.yx, vec2(39.346, 11.135))) * 24634.6345);
    gl_FragColor.rgb += (n + m - 1.0) / 255.0; // dither: no banding in the slow gradient
  }
`;

/** Medium tier's fake reflection: the mounds mirrored in y, fading with depth and distance. */
const MIRROR_VERT = /* glsl */ `
  varying float vDepth;
  varying float vDist;
  void main() {
    vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0);
    w.y = -w.y;
    vDepth = -w.y;
    vDist = length(w.xz - cameraPosition.xz);
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

const MIRROR_FRAG = /* glsl */ `
  uniform vec3 uTint;
  uniform float uFade;
  varying float vDepth;
  varying float vDist;
  void main() {
    float a = (1.0 - smoothstep(0.0, 0.17, vDepth)) * (1.0 - smoothstep(2.0, 9.0, vDist));
    gl_FragColor = vec4(uTint, a * 0.62 * uFade);
    #include <colorspace_fragment>
  }
`;

const SHADOW_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(position, 1.0);
  }
`;

const SHADOW_FRAG = /* glsl */ `
  uniform float uFade;
  uniform vec3 uColor;
  varying vec2 vUv;
  void main() {
    float d = length(vUv - 0.5) * 2.0;
    gl_FragColor = vec4(uColor, exp(-d * d * 3.6) * (1.0 - smoothstep(0.75, 1.0, d)) * 0.3 * uFade);
    #include <colorspace_fragment>
  }
`;

export interface PanLights {
  key: { color: Color };
  hemiGround: Color;
  setHemi(intensity: number): void;
}

export interface SaltPans {
  group: Object3D;
  /** The horizon colour: the fog follows the sky. */
  horizon: Color;
  update(p: number): void;
  /** High tier only: renders the mirrored mounds and bunds, before the main render. */
  renderReflection(renderer: WebGLRenderer, scene: Scene, camera: PerspectiveCamera): void;
  dispose(): void;
}

/** Blush progress. It runs over the last 25% of the scroll, but only shows in earnest late on. */
export function blushAt(p: number): number {
  const t = clamp01((p - 0.75) / 0.235);
  return Math.pow(t * t * (3 - 2 * t), 2.2);
}

export function createSaltPans(planar: boolean, width: number, height: number): SaltPans {
  const group = new Object3D();
  const grain = grainTexture();
  const { rnd } = createRng(53);

  // ---- mounds: three variants, instanced ----
  const moundMat = new MeshStandardMaterial({
    color: MOUND_ALBEDO,
    roughness: 0.96,
    vertexColors: true,
    bumpMap: grain,
    bumpScale: 2.4,
    envMapIntensity: 0.32,
    toneMapped: false,
  });
  const variants = [61, 67, 71].map((seed) => moundGeometry(seed));
  const byVariant: {
    x: number;
    z: number;
    s: number;
    rot: number;
    rise: number;
    order: number;
  }[][] = [[], [], []];
  MOUNDS.forEach(([x, z, s], i) =>
    byVariant[i % 3]!.push({ x, z, s, rot: rnd() * 6.28, rise: -1, order: i / MOUNDS.length }),
  );
  const meshes = variants.map((g, v) => {
    const m = new InstancedMesh(g, moundMat, byVariant[v]!.length);
    m.frustumCulled = false;
    m.layers.enable(REFLECT_LAYER);
    group.add(m);
    return m;
  });

  // ---- bunds ----
  const bundMat = new MeshStandardMaterial({
    color: 0xa89e8d,
    roughness: 1,
    envMapIntensity: 0.32,
    toneMapped: false,
  });
  const bunds = new InstancedMesh(bundGeometry(), bundMat, BUNDS_Z.length + BUNDS_X.length);
  bunds.frustumCulled = false;
  bunds.layers.enable(REFLECT_LAYER);
  group.add(bunds);
  const dummy = new Object3D();
  let n = 0;
  for (const z of BUNDS_Z) {
    dummy.position.set(0, 0, z);
    dummy.rotation.set(0, (rnd() - 0.5) * 0.02, 0);
    dummy.scale.set(14, 0.007, 0.02);
    dummy.updateMatrix();
    bunds.setMatrixAt(n++, dummy.matrix);
  }
  for (const x of BUNDS_X) {
    dummy.position.set(x, 0, -4.78); // from the first cross bund to the last
    dummy.rotation.set(0, Math.PI / 2 + (rnd() - 0.5) * 0.012, 0);
    dummy.scale.set(5.85, 0.0065, 0.018);
    dummy.updateMatrix();
    bunds.setMatrixAt(n++, dummy.matrix);
  }
  bunds.instanceMatrix.needsUpdate = true;

  // ---- soft ground shadows, one call ----
  const shadowUniforms = { uFade: { value: 0 }, uColor: { value: new Color('#6b5a58') } };
  const shadows = new InstancedMesh(
    new PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
    new ShaderMaterial({
      vertexShader: SHADOW_VERT,
      fragmentShader: SHADOW_FRAG,
      uniforms: shadowUniforms,
      transparent: true,
      depthWrite: false,
    }),
    MOUNDS.length,
  );
  shadows.frustumCulled = false;
  shadows.position.y = 0.0006;
  shadows.renderOrder = 1;
  group.add(shadows);

  // ---- medium tier: mirrored mounds drawn over the water ----
  const mirrorUniforms = { uTint: { value: new Color() }, uFade: { value: 0 } };
  const mirrorMat = new ShaderMaterial({
    vertexShader: MIRROR_VERT,
    fragmentShader: MIRROR_FRAG,
    uniforms: mirrorUniforms,
    transparent: true,
    depthWrite: false,
    side: 2,
  });
  const mirrors = planar
    ? []
    : variants.map((g, v) => {
        const m = new InstancedMesh(g, mirrorMat, byVariant[v]!.length);
        m.frustumCulled = false;
        m.renderOrder = 2;
        group.add(m);
        return m;
      });

  // ---- brine ----
  const rt = planar
    ? new WebGLRenderTarget(Math.max(2, width >> 1), Math.max(2, height >> 1), {
        type: HalfFloatType,
        minFilter: LinearFilter,
        magFilter: LinearFilter,
        depthBuffer: true,
      })
    : null;
  const texMat = new Matrix4();
  const waterUniforms = {
    uRefl: { value: rt?.texture ?? null },
    uHasRefl: { value: planar ? 1 : 0 },
    uTexMat: { value: texMat },
    uPink: { value: 0 },
    uFade: { value: 0 },
    uWhite: { value: WHITE_WATER },
    uNear: { value: PINK_NEAR },
    uFar: { value: PINK_FAR },
    uSky: { value: new Color() },
    uBx: { value: BUNDS_X },
    uBz: { value: BUNDS_Z },
  };
  const water = new Mesh(
    new PlaneGeometry(90, 90).rotateX(-Math.PI / 2),
    new ShaderMaterial({
      vertexShader: WATER_VERT,
      fragmentShader: WATER_FRAG,
      uniforms: waterUniforms,
      defines: { BX: BUNDS_X.length, BZ: BUNDS_Z.length },
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  water.position.set(0, 0.0002, -20);
  group.add(water);

  // ---- sky ----
  const skyUniforms = {
    uTop: { value: new Color() },
    uHor: { value: new Color() },
    uFade: { value: 0 },
  };
  const sky = new Mesh(
    new SphereGeometry(1, 24, 12),
    new ShaderMaterial({
      vertexShader: SKY_VERT,
      fragmentShader: SKY_FRAG,
      uniforms: skyUniforms,
      side: BackSide,
      transparent: true,
      depthWrite: false, // drawn at the far plane: anything opaque in front of it stays in front
      toneMapped: false,
    }),
  );
  sky.frustumCulled = false;
  sky.renderOrder = -2;
  group.add(sky);

  const horizon = new Color();
  const place = (p: number) => {
    const m = new Matrix4();
    let shadowIndex = 0;
    byVariant.forEach((list, v) => {
      let dirty = false;
      list.forEach((d, i) => {
        // near rows first, as the crystals spread outward
        const start = 0.782 + d.order * 0.07;
        const k = smooth(start, start + 0.05, p);
        if (k !== d.rise) {
          d.rise = k;
          dirty = true;
        }
        dummy.position.set(d.x, 0, d.z);
        dummy.rotation.set(0, d.rot, 0);
        dummy.scale.set(
          d.s * (0.72 + 0.28 * k),
          d.s * Math.max(k, 0.0001),
          d.s * (0.72 + 0.28 * k),
        );
        dummy.updateMatrix();
        m.copy(dummy.matrix);
        meshes[v]!.setMatrixAt(i, m);
        mirrors[v]?.setMatrixAt(i, m);
        // long and soft, away from the key light
        dummy.position.set(d.x - 0.09 * d.s, 0, d.z - 0.1 * d.s);
        dummy.rotation.set(0, 0.7, 0);
        dummy.scale.set(0.62 * d.s * k, 1, 0.42 * d.s * k);
        dummy.updateMatrix();
        shadows.setMatrixAt(shadowIndex++, dummy.matrix);
      });
      if (dirty) {
        meshes[v]!.instanceMatrix.needsUpdate = true;
        if (mirrors[v]) mirrors[v]!.instanceMatrix.needsUpdate = true;
        shadows.instanceMatrix.needsUpdate = true;
      }
    });
  };

  const virtual = new PerspectiveCamera();
  const target = new Vector3();
  const dir = new Vector3();
  const biasM = new Matrix4().set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
  virtual.layers.set(REFLECT_LAYER);

  return {
    group,
    horizon,
    update(p) {
      const fade = smooth(0.78, 0.9, p);
      const pink = blushAt(p);
      group.visible = fade > 0.001;
      if (!group.visible) return;
      place(p);
      waterUniforms.uPink.value = pink;
      waterUniforms.uFade.value = fade;
      horizon.copy(SKY_HOR_WHITE).lerp(SKY_HOR_PINK, pink);
      skyUniforms.uHor.value.copy(horizon);
      skyUniforms.uTop.value.copy(SKY_TOP_WHITE).lerp(SKY_TOP_PINK, pink);
      skyUniforms.uFade.value = fade;
      waterUniforms.uSky.value.copy(horizon);
      shadowUniforms.uFade.value = fade;
      mirrorUniforms.uFade.value = fade;
      mirrorUniforms.uTint.value.set(0xffffff).lerp(PINK_NEAR, pink * 0.45);
    },
    renderReflection(renderer, scene, camera) {
      if (!rt || !group.visible) return;
      camera.getWorldDirection(dir);
      virtual.position.set(camera.position.x, -camera.position.y, camera.position.z);
      target.copy(camera.position).add(dir);
      target.y = -target.y;
      virtual.up.set(0, 1, 0);
      virtual.lookAt(target);
      virtual.near = camera.near;
      virtual.far = camera.far;
      virtual.updateMatrixWorld();
      virtual.projectionMatrix.copy(camera.projectionMatrix);
      virtual.projectionMatrixInverse.copy(camera.projectionMatrixInverse);
      texMat.copy(biasM).multiply(virtual.projectionMatrix).multiply(virtual.matrixWorldInverse);

      const prevTarget = renderer.getRenderTarget();
      const prevShadow = renderer.shadowMap.autoUpdate;
      const clear = new Color();
      renderer.getClearColor(clear);
      const alpha = renderer.getClearAlpha();
      renderer.shadowMap.autoUpdate = false;
      renderer.setRenderTarget(rt);
      renderer.setClearColor(0x000000, 0);
      renderer.clear();
      renderer.render(scene, virtual);
      renderer.setRenderTarget(prevTarget);
      renderer.setClearColor(clear, alpha);
      renderer.shadowMap.autoUpdate = prevShadow;
    },
    dispose() {
      rt?.dispose();
      grain.dispose();
    },
  };
}
