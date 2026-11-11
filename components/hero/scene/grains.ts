import {
  CanvasTexture,
  Color,
  DynamicDrawUsage,
  Euler,
  IcosahedronGeometry,
  InstancedMesh,
  LatheGeometry,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Quaternion,
  RepeatWrapping,
  SRGBColorSpace,
  Vector2,
  Vector3,
} from 'three';
import {
  FLIGHT,
  MOUND_H,
  REPOSE,
  emitAt,
  lipAt,
  moundHeightAt,
  moundX,
  pourRate,
} from '@/lib/motion/pour';
import { createRng } from './math';

/**
 * The pour. Every grain's whole life is computed once: when it leaves the lip, its arc down,
 * where it strikes the growing cone and where it comes to rest on it (a few roll right down
 * to the foot). Each frame only evaluates those paths at progress p: no physics, no state
 * between frames, so the same p always gives the same picture and scrolling back reverses it.
 */

/** Black-salt colours, matched to the product photo: grey-brown with a red-brown minority. */
const BASE = new Color('#6a5649');
const DARK = new Color('#3e2a22');
const LIGHT = new Color('#8c7c74');
const RED = new Color('#80524a');
const GLINT = new Color('#efe2c8');
const RED_SHARE = 0.15;
/** A few per cent of the grains catch the low key light as tiny glints. */
const GLINT_SHARE = 0.035;
/** Half the old grain size (0.7–1.8 mm), ±35%. */
const SIZE = 0.000625;
/** Loose grains that roll down to the foot of the cone. */
const ROLL_SHARE = 0.06;
const SLIDE = 0.006;
const ROLL = 0.03;

// per grain, in flat arrays (no objects per grain)
const F = 16;
const TE = 0;
const TF = 1; // flight time
const SX = 2; // where it leaves the lip
const SY = 3;
const AX = 4; // where it strikes the cone
const AY = 5;
const AZ = 6;
const RHO = 7; // its resting place: radius on the cone and angle
const ANG = 8;
const HL = 9; // the cone's height when it lands
const TS = 10; // slide time to rest
const SZ = 11; // size
const RX = 12;
const RY = 13;
const SPIN = 14;
const JIT = 15; // stream jitter

export interface Pour {
  grains: InstancedMesh;
  dust: InstancedMesh;
  mound: Mesh;
  /** The pour's mound centre (x). */
  mx: number;
  update(p: number): void;
  dispose(): void;
}

function noiseTexture(): CanvasTexture {
  const S = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = S;
  const g = canvas.getContext('2d')!;
  const img = g.createImageData(S, S);
  const { rnd } = createRng(41);
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
  t.repeat.set(10, 4);
  t.colorSpace = SRGBColorSpace;
  return t;
}

/** Builds the pour for a jar that starts at x0. Seeded: always the same pour. */
export function createPour(count: number, x0: number, shadows: boolean): Pour {
  const dustCount = Math.round(count * 0.15);
  const mainCount = count - dustCount;
  const mx = moundX(x0);

  const geo = new IcosahedronGeometry(1, 0);
  const grains = new InstancedMesh(
    geo,
    new MeshStandardMaterial({ color: 0xffffff, roughness: 0.22, metalness: 0, flatShading: true }),
    mainCount,
  );
  const dust = new InstancedMesh(
    geo,
    new MeshStandardMaterial({
      color: 0x8a7a70,
      roughness: 0.6,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
      flatShading: true,
    }),
    dustCount,
  );
  for (const m of [grains, dust]) {
    m.instanceMatrix.setUsage(DynamicDrawUsage);
    m.frustumCulled = false;
  }
  grains.castShadow = shadows;

  // the cone: 35°, a softly rounded top, grown by scale (the angle never changes)
  const r0 = MOUND_H / REPOSE;
  const prof: Vector2[] = [];
  for (let i = 0; i <= 24; i++) {
    const t = i / 24;
    const r = r0 * t;
    const y = MOUND_H - r * REPOSE + 0.0035 * Math.pow(1 - t, 6) * -1;
    prof.push(new Vector2(r, Math.max(0, y)));
  }
  prof.push(new Vector2(r0 * 1.04, 0));
  const noise = noiseTexture();
  const mound = new Mesh(
    new LatheGeometry(prof, 72),
    new MeshStandardMaterial({ color: 0x5f4d42, map: noise, roughness: 0.95, metalness: 0 }),
  );
  mound.castShadow = shadows;
  mound.receiveShadow = shadows;
  mound.visible = false;

  const build = (n: number, seed: number, size: number, isDust: boolean, mesh: InstancedMesh) => {
    const { rnd, gauss } = createRng(seed);
    const tint = createRng(seed + 18).rnd;
    const c = new Color();
    const d = new Float32Array(n * F);
    for (let i = 0; i < n; i++) {
      const o = i * F;
      const u = Math.min(0.9999, (i + rnd()) / n);
      const te = emitAt(u);
      const tf = FLIGHT * (0.85 + rnd() * 0.3);
      const lip = lipAt(te, x0);
      const hl = MOUND_H * Math.cbrt(u); // the cone when it lands
      const roll = !isDust && rnd() < ROLL_SHARE;
      const rmax = hl / REPOSE;
      d[o + TE] = te;
      d[o + TF] = tf;
      d[o + SX] = lip[0];
      d[o + SY] = lip[1];
      d[o + AX] = mx + gauss() * 0.0018;
      d[o + AY] = hl;
      d[o + AZ] = gauss() * 0.0018;
      d[o + RHO] = roll ? rmax * (1.02 + rnd() * 0.06) : rmax * Math.sqrt(rnd()) * 0.97;
      d[o + ANG] = rnd() * Math.PI * 2;
      d[o + HL] = hl;
      d[o + TS] = roll ? ROLL * (0.7 + rnd() * 0.6) : SLIDE * (0.6 + rnd() * 0.8);
      d[o + SZ] = size * (1 + (rnd() * 2 - 1) * 0.35);
      d[o + RX] = rnd() * 6;
      d[o + RY] = rnd() * 6;
      d[o + SPIN] = roll ? 30 + rnd() * 30 : 4 + rnd() * 10;
      d[o + JIT] = (rnd() - 0.5) * (isDust ? 0.012 : 0.004);
      if (!isDust) {
        c.copy(BASE).lerp(tint() < 0.5 ? DARK : LIGHT, tint() * 0.8);
        if (tint() < RED_SHARE) c.lerp(RED, 0.4 + tint() * 0.4);
        if (tint() < GLINT_SHARE) c.copy(GLINT);
        mesh.setColorAt(i, c);
      }
    }
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    return d;
  };
  const main = build(mainCount, 11, SIZE, false, grains);
  const fine = build(dustCount, 23, SIZE * 0.4, true, dust);

  const m4 = new Matrix4();
  const q = new Quaternion();
  const e3 = new Euler();
  const v3 = new Vector3();
  const sc = new Vector3();
  const zero = new Matrix4().makeScale(0, 0, 0);

  const place = (mesh: InstancedMesh, d: Float32Array, n: number, p: number, isDust: boolean) => {
    for (let i = 0; i < n; i++) {
      const o = i * F;
      const te = d[o + TE]!;
      if (p < te) {
        mesh.setMatrixAt(i, zero); // still in the jar
        continue;
      }
      const tf = d[o + TF]!;
      let x: number;
      let y: number;
      let z: number;
      let s = d[o + SZ]!;
      let rot = 0;
      if (p < te + tf) {
        // the arc: leaves the lip, falls under gravity onto the cone's top
        const k = (p - te) / tf;
        const w = d[o + JIT]! * (0.4 + pourRate(te)) * k;
        x = d[o + SX]! + (d[o + AX]! - d[o + SX]!) * k + w;
        y = d[o + SY]! + (d[o + AY]! - d[o + SY]!) * k * k;
        z = d[o + AZ]! * k + w * 0.6;
        rot = k * d[o + SPIN]!;
      } else {
        // down the cone's surface to where it rests (or rolls to the foot)
        const k = Math.min(1, (p - te - tf) / d[o + TS]!);
        const e = 1 - (1 - k) * (1 - k);
        const rho = d[o + RHO]! * e;
        const a = d[o + ANG]!;
        const hl = d[o + HL]!;
        x = d[o + AX]! + (mx + Math.cos(a) * rho - d[o + AX]!) * e;
        z = d[o + AZ]! + (Math.sin(a) * rho - d[o + AZ]!) * e;
        y = Math.max(s, hl - rho * REPOSE) + s * 0.5;
        rot = d[o + SPIN]! * (1 + e);
        if (isDust) s *= 1 - k; // dust settles out of sight
      }
      e3.set(d[o + RX]! + rot, d[o + RY]! + rot * 0.6, 0);
      q.setFromEuler(e3);
      m4.compose(v3.set(x, y, z), q, sc.set(s, s * 0.8, s));
      mesh.setMatrixAt(i, m4);
    }
    mesh.instanceMatrix.needsUpdate = true;
  };

  let last = NaN;
  return {
    grains,
    dust,
    mound,
    mx,
    update(p: number) {
      if (p === last) return;
      last = p;
      place(grains, main, mainCount, p, false);
      place(dust, fine, dustCount, p, true);
      const h = moundHeightAt(p);
      mound.visible = h > 0.0004;
      const k = h / MOUND_H;
      mound.position.set(mx, 0, 0);
      mound.scale.set(k, k, k);
    },
    dispose() {
      geo.dispose();
      (grains.material as MeshStandardMaterial).dispose();
      (dust.material as MeshStandardMaterial).dispose();
      mound.geometry.dispose();
      (mound.material as MeshStandardMaterial).dispose();
      noise.dispose();
    },
  };
}
