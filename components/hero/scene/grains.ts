import {
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  DoubleSide,
  DynamicDrawUsage,
  Euler,
  IcosahedronGeometry,
  InstancedMesh,
  LatheGeometry,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  OctahedronGeometry,
  Quaternion,
  RepeatWrapping,
  SRGBColorSpace,
  TetrahedronGeometry,
  Vector2,
  Vector3,
  type BufferGeometry as Geo,
} from 'three';
import { DUST, GRAIN, SEC, flowAt, moundHeightAt, type PourResult } from '@/lib/motion/pourSim';
import { lipAt, tiltAt } from '@/lib/motion/pour';
import { createRng } from './math';

/**
 * The pour on screen, played back from the simulation (lib/motion/pourSim.ts): each frame only
 * evaluates every grain's precomputed life at f (in the jar, in flight, landing, a hop, sliding
 * to rest), so the same f always gives the same picture and scrolling back reverses it.
 *
 * - a dense stream core: a thin camera-facing ribbon from the lip down to the mound, its width
 *   following the flow at the moment each part of it left the lip (wide over the lip, narrowing)
 * - instanced grains in three crystal shapes (±35% size) breaking away at its edges; a few
 *   catch the warm key light as glints
 * - fine dust: puffs at the impacts, gone in 0.6 s (none on the low tier)
 * - the mound: a 35° cone grown by the volume that has landed
 */

/** Black-salt colours, matched to the product photo: grey-brown with a red-brown minority. */
const BASE = new Color('#6a5649');
const DARK = new Color('#3e2a22');
const LIGHT = new Color('#8c7c74');
const RED = new Color('#80524a');
const GLINT = new Color('#efe2c8');
const REPOSE = Math.tan((35 * Math.PI) / 180);
const DUST_LIFE = 0.6 * SEC;
const G = 9.81;
const DRAG = 1.6;
const RIBBON = 28; // segments

export interface Pour {
  group: Mesh[];
  mound: Mesh;
  /** The pour's mound centre (x). */
  mx: number;
  update(f: number, camera: Vector3, x0: number): void;
  dispose(): void;
}

function noiseTexture(seed: number, repeat: [number, number]): CanvasTexture {
  const S = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = S;
  const g = canvas.getContext('2d')!;
  const img = g.createImageData(S, S);
  const { rnd } = createRng(seed);
  for (let i = 0; i < S * S; i++) {
    const v = 150 + rnd() * 105;
    img.data[i * 4] = v;
    img.data[i * 4 + 1] = v * 0.97;
    img.data[i * 4 + 2] = v * 0.94;
    img.data[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new CanvasTexture(canvas);
  t.wrapS = t.wrapT = RepeatWrapping;
  t.repeat.set(...repeat);
  t.colorSpace = SRGBColorSpace;
  return t;
}

/** The stream's grain: a soft-edged strip (alpha) with a fine grain inside. */
function streamTexture(): CanvasTexture {
  const W = 64;
  const Hh = 256;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = Hh;
  const g = canvas.getContext('2d')!;
  const img = g.createImageData(W, Hh);
  const { rnd } = createRng(77);
  for (let y = 0; y < Hh; y++)
    for (let x = 0; x < W; x++) {
      const u = (x + 0.5) / W - 0.5;
      const edge = Math.max(0, 1 - Math.pow(Math.abs(u) * 2, 2.2));
      const grain = 0.55 + rnd() * 0.45;
      const i = (y * W + x) * 4;
      const v = 120 + rnd() * 80;
      img.data[i] = v;
      img.data[i + 1] = v * 0.9;
      img.data[i + 2] = v * 0.85;
      img.data[i + 3] = 255 * edge * (rnd() < 0.15 + 0.85 * edge ? grain : 0.2);
    }
  g.putImageData(img, 0, 0);
  const t = new CanvasTexture(canvas);
  t.wrapS = t.wrapT = RepeatWrapping;
  t.colorSpace = SRGBColorSpace;
  return t;
}

/** Builds the pour from the simulation. Seeded: always the same pour. */
export function createPour(sim: PourResult, x0: number, shadows: boolean, dustOn: boolean): Pour {
  const N = GRAIN.N;
  const count = sim.grains.length / N;
  const shapes: Geo[] = [
    new IcosahedronGeometry(1, 0),
    new OctahedronGeometry(1, 0),
    new TetrahedronGeometry(1.25, 0),
  ];
  const mat = new MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.22,
    metalness: 0,
    flatShading: true,
  });
  // which grains each shape draws
  const lists: number[][] = [[], [], []];
  for (let i = 0; i < count; i++) lists[sim.grains[i * N + GRAIN.shape]!]!.push(i);
  const zero = new Matrix4().makeScale(0, 0, 0);
  const tint = createRng(18).rnd;
  const c = new Color();
  const meshes = lists.map((list, s) => {
    const m = new InstancedMesh(shapes[s]!, mat, Math.max(1, list.length));
    m.instanceMatrix.setUsage(DynamicDrawUsage);
    m.frustumCulled = false;
    m.castShadow = shadows;
    list.forEach((g, j) => {
      m.setMatrixAt(j, zero);
      c.copy(BASE).lerp(tint() < 0.5 ? DARK : LIGHT, tint() * 0.8);
      if (tint() < 0.15) c.lerp(RED, 0.4 + tint() * 0.4);
      if (sim.grains[g * N + GRAIN.glint]) c.copy(GLINT);
      m.setColorAt(j, c);
    });
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    return m;
  });

  const dustN = dustOn ? sim.dust.length / DUST.N : 0;
  const dustMat = new MeshStandardMaterial({
    color: 0x8a7a70,
    roughness: 0.6,
    transparent: true,
    opacity: 0.4,
    depthWrite: false,
    flatShading: true,
  });
  const dust = new InstancedMesh(shapes[0]!, dustMat, Math.max(1, dustN));
  dust.instanceMatrix.setUsage(DynamicDrawUsage);
  dust.frustumCulled = false;
  for (let i = 0; i < dust.count; i++) dust.setMatrixAt(i, zero);

  // the mound: a 35° cone with a softly rounded top, grown by scale (the angle never changes)
  const H0 = sim.mound.hEnd;
  const r0 = H0 / REPOSE;
  const prof: Vector2[] = [];
  for (let i = 0; i <= 24; i++) {
    const t = i / 24;
    const r = r0 * t;
    prof.push(new Vector2(r, Math.max(0, H0 - r * REPOSE - 0.0035 * Math.pow(1 - t, 6))));
  }
  prof.push(new Vector2(r0 * 1.04, 0));
  const noise = noiseTexture(41, [10, 4]);
  const mound = new Mesh(
    new LatheGeometry(prof, 72),
    new MeshStandardMaterial({ color: 0x5f4d42, map: noise, roughness: 0.95, metalness: 0 }),
  );
  mound.castShadow = shadows;
  mound.receiveShadow = shadows;
  mound.visible = false;
  const mx = sim.mound.x;

  // the stream core: a camera-facing ribbon (RIBBON segments), rebuilt each frame
  const rPos = new Float32Array((RIBBON + 1) * 2 * 3);
  const rUv = new Float32Array((RIBBON + 1) * 2 * 2);
  const idx: number[] = [];
  for (let i = 0; i < RIBBON; i++) {
    const a = i * 2;
    idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  const rGeo = new BufferGeometry();
  rGeo.setAttribute('position', new BufferAttribute(rPos, 3).setUsage(DynamicDrawUsage));
  rGeo.setAttribute('uv', new BufferAttribute(rUv, 2).setUsage(DynamicDrawUsage));
  rGeo.setIndex(idx);
  const streamTex = streamTexture();
  const ribbon = new Mesh(
    rGeo,
    new MeshBasicMaterial({
      color: 0x6a5548,
      map: streamTex,
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
    }),
  );
  ribbon.frustumCulled = false;
  ribbon.visible = false;

  const m4 = new Matrix4();
  const q = new Quaternion();
  const e3 = new Euler();
  const v3 = new Vector3();
  const sc = new Vector3();
  const pt = new Vector3();
  const tan = new Vector3();
  const side = new Vector3();
  const view = new Vector3();
  const pts: Vector3[] = Array.from({ length: RIBBON + 1 }, () => new Vector3());

  const flight = (o: number, t: number) => {
    const g = sim.grains;
    const e = (1 - Math.exp(-DRAG * t)) / DRAG;
    v3.set(
      g[o + GRAIN.sx]! + g[o + GRAIN.vx]! * e,
      g[o + GRAIN.sy]! + (g[o + GRAIN.vy]! + G / DRAG) * e - (G * t) / DRAG,
      g[o + GRAIN.sz]! + g[o + GRAIN.vz]! * e,
    );
    return v3;
  };

  const place = (f: number) => {
    const g = sim.grains;
    meshes.forEach((mesh, s) => {
      const list = lists[s]!;
      for (let j = 0; j < list.length; j++) {
        const o = list[j]! * N;
        const te = g[o + GRAIN.te]!;
        if (f < te) {
          mesh.setMatrixAt(j, zero); // still in the jar
          continue;
        }
        const tl = g[o + GRAIN.tl]!;
        const size = g[o + GRAIN.size]!;
        let rot = 0;
        if (f < tl) {
          // in flight: ballistic, with light drag
          flight(o, (f - te) / SEC);
          rot = ((f - te) / SEC) * g[o + GRAIN.spin]!;
        } else {
          // landed: maybe one hop, then down the cone to its resting place
          const k = Math.min(1, (f - tl) / g[o + GRAIN.ts]!);
          const e = 1 - (1 - k) * (1 - k);
          const hop = g[o + GRAIN.bounce]! * 4 * k * (1 - k);
          v3.set(
            g[o + GRAIN.lx]! + (g[o + GRAIN.rx]! - g[o + GRAIN.lx]!) * e,
            g[o + GRAIN.ly]! + (g[o + GRAIN.ry]! - g[o + GRAIN.ly]!) * e + hop,
            g[o + GRAIN.lz]! + (g[o + GRAIN.rz]! - g[o + GRAIN.lz]!) * e,
          );
          rot = g[o + GRAIN.spin]! * (1 + e);
        }
        e3.set(g[o + GRAIN.r0]! + rot, g[o + GRAIN.r1]! + rot * 0.6, 0);
        q.setFromEuler(e3);
        m4.compose(v3, q, sc.set(size, size * 0.8, size));
        mesh.setMatrixAt(j, m4);
      }
      mesh.instanceMatrix.needsUpdate = true;
    });
    if (dustN) {
      const d = sim.dust;
      for (let i = 0; i < dustN; i++) {
        const o = i * DUST.N;
        const t0 = d[o + DUST.t0]!;
        if (f < t0 || f > t0 + DUST_LIFE) {
          dust.setMatrixAt(i, zero);
          continue;
        }
        const t = (f - t0) / SEC;
        const k = (f - t0) / DUST_LIFE;
        const s = d[o + DUST.size]! * (1 + k * 2) * (1 - k);
        v3.set(
          d[o + DUST.x]! + d[o + DUST.vx]! * t,
          d[o + DUST.y]! + d[o + DUST.vy]! * t - 0.15 * t * t,
          d[o + DUST.z]! + d[o + DUST.vz]! * t,
        );
        m4.compose(v3, q.identity(), sc.set(s, s, s));
        dust.setMatrixAt(i, m4);
      }
      dust.instanceMatrix.needsUpdate = true;
    }
  };

  /** The stream core at f: the path a grain from the lowest point takes, width from the flow. */
  const stream = (f: number, cam: Vector3, x0: number) => {
    const qNow = flowAt(sim, f);
    // the stream is in the air for up to ~0.3 s: show it while any of it is
    if (flowAt(sim, f) <= 0.001 && flowAt(sim, f - 0.3 * SEC) <= 0.001) {
      ribbon.visible = false;
      return;
    }
    ribbon.visible = true;
    const lip = lipAt(f, x0);
    const a = tiltAt(f);
    const s = Math.sin(a);
    const c = Math.cos(a);
    // leaving the lip: along the axis and outwards (as the grains do), at the flow's speed
    const speed = 0.08 + 0.22 * qNow;
    let vx = -s * 0.55 - c * 0.85;
    let vy = c * 0.55 - s * 0.85;
    const vl = Math.hypot(vx, vy) || 1;
    vx = (vx / vl) * speed;
    vy = Math.min(0, (vy / vl) * speed) - 0.02;
    const h = moundHeightAt(sim, f);
    let tEnd = 0.6;
    for (let i = 0; i <= RIBBON; i++) {
      const t = (i / RIBBON) * tEnd;
      const e = (1 - Math.exp(-DRAG * t)) / DRAG;
      pts[i]!.set(lip[0] + vx * e, lip[1] + (vy + G / DRAG) * e - (G * t) / DRAG, 0);
      const ground = Math.max(0, h - Math.abs(pts[i]!.x - mx) * REPOSE);
      if (pts[i]!.y < ground && i > 0) {
        tEnd = t;
        for (let j = i; j <= RIBBON; j++) pts[j]!.copy(pts[i]!).setY(ground);
        break;
      }
    }
    for (let i = 0; i <= RIBBON; i++) {
      const p = pts[i]!;
      const prev = pts[Math.max(0, i - 1)]!;
      const next = pts[Math.min(RIBBON, i + 1)]!;
      tan.subVectors(next, prev).normalize();
      view.subVectors(cam, p).normalize();
      side.crossVectors(tan, view).normalize();
      // this part of the stream left the lip τ ago: its width is the flow then; wide over the
      // lip (a sheet), narrowing as it falls
      const tau = (i / RIBBON) * tEnd;
      const qn = flowAt(sim, f - tau * SEC);
      const w = 0.011 * Math.sqrt(qn) * (1.5 - (0.65 * i) / RIBBON);
      pt.copy(p).addScaledVector(side, w / 2);
      rPos.set([pt.x, pt.y, pt.z], i * 6);
      pt.copy(p).addScaledVector(side, -w / 2);
      rPos.set([pt.x, pt.y, pt.z], i * 6 + 3);
      const v = (i / RIBBON) * 4 - f * 600; // the grain runs down the stream as it scrolls
      rUv.set([0, v, 1, v], i * 4);
    }
    rGeo.attributes.position!.needsUpdate = true;
    rGeo.attributes.uv!.needsUpdate = true;
    rGeo.computeBoundingSphere();
  };

  let last = NaN;
  return {
    group: [...meshes, dust, ribbon],
    mound,
    mx,
    update(f: number, cam: Vector3, x0: number) {
      stream(f, cam, x0);
      if (f === last) return;
      last = f;
      place(f);
      const h = moundHeightAt(sim, f);
      mound.visible = h > 0.0004;
      const k = h / H0;
      mound.position.set(mx, 0, 0);
      mound.scale.set(k, k, k);
    },
    dispose() {
      shapes.forEach((s) => s.dispose());
      mat.dispose();
      dustMat.dispose();
      mound.geometry.dispose();
      (mound.material as MeshStandardMaterial).dispose();
      noise.dispose();
      rGeo.dispose();
      (ribbon.material as MeshBasicMaterial).dispose();
      streamTex.dispose();
    },
  };
}
