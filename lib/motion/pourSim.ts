/**
 * The pour, simulated once (in a Web Worker, components/hero/scene/pourWorker.ts) from the
 * jar's choreography (lib/motion/pour.ts). Pure and seeded: the same input always gives the
 * same pour, and the scene only evaluates the results at the film's progress f, so scrolling
 * back reverses it exactly.
 *
 * The salt:
 * - Its free surface is level in the WORLD (a plane at height L); the volume below it inside
 *   the tilted cylinder is integrated slice by slice (circle segments).
 * - The most the jar can hold at a tilt is the volume below the rim's lowest point. Salt flows
 *   only while there is more than that (the surface has reached the lip); the rate follows the
 *   overhang (0 → peak → 0) with a drain time set so about 30% stays in the jar (the dive lands
 *   on it). The mound gets exactly what leaves the jar.
 * The grains:
 * - Each carries an equal share of the volume, so emission times follow the flow (inverse CDF).
 * - Each leaves ON the lip, from the rim arc around its lowest point (±25°), moving outwards
 *   and down along the lip; then flies ballistically with light (linear) drag.
 * - It lands on the growing cone (35°, the angle of repose; its height from the volume landed
 *   so far), ~10% bounce once, a few roll to the foot, the rest settle onto the cone ordered by
 *   landing time. Dust: fine particles puffed out at impacts, gone in 0.6 s.
 */
import { INNER, POUR, R, lipAt, moundX, pivotAt, tiltAt } from './pour';

/** Film progress per physical second of the pour (shot 4: 5 s over its 35% of the film). */
export const SEC = (POUR.end - POUR.start) / 5;
const G = 9.81;
const DRAG = 1.6; // 1/s
const REPOSE = Math.tan((35 * Math.PI) / 180);
/** The jar's surface slope while salt runs out (the angle of repose of the moving salt). */
export const SLOPE = (32 * Math.PI) / 180;
const PACK = 1.0; // the cone's volume per volume poured
const KEEP = 0.3; // what stays in the jar
const STEPS = 1400;

/** Per grain, in flat arrays: see GRAIN. */
export const GRAIN = {
  te: 0, // leaves the lip (f)
  tl: 1, // lands (f)
  sx: 2,
  sy: 3,
  sz: 4, // where it leaves
  vx: 5,
  vy: 6,
  vz: 7, // its velocity then (m/s)
  lx: 8,
  ly: 9,
  lz: 10, // where it lands
  rx: 11,
  ry: 12,
  rz: 13, // where it comes to rest
  ts: 14, // slide time to rest (f)
  bounce: 15, // hop height (m), 0: none
  size: 16,
  shape: 17, // 0–2
  r0: 18,
  r1: 19, // rotation seeds
  spin: 20,
  glint: 21, // 1: catches the light
  N: 22,
} as const;
/** Per dust mote. */
export const DUST = { t0: 0, x: 1, y: 2, z: 3, vx: 4, vy: 5, vz: 6, size: 7, N: 8 } as const;

export interface PourInput {
  x0: number;
  grains: number;
  dust: number;
}

export interface PourResult {
  /** f at each table step (POUR.start…POUR.end), and the volume in the jar / the flow there. */
  table: { f0: number; df: number; level: Float32Array; volume: Float32Array; q: Float32Array };
  /** first and last flowing f */
  onset: number;
  stop: number;
  /** the flow's peak (m³/s), for normalising */
  qMax: number;
  /** the full jar's volume, and what's left after the pour */
  v0: number;
  vEnd: number;
  /** the level (world y of the free surface, jar upright) after the pour, in the jar frame */
  levelEnd: number;
  mound: { x: number; hEnd: number };
  grains: Float32Array;
  dust: Float32Array;
}

function rng(seed: number) {
  let s = seed >>> 0;
  const rnd = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-9)) * Math.cos(2 * Math.PI * rnd());
  return { rnd, gauss };
}

/** Area of the jar's cross-section (radius r) on the side x < d of a chord (d from the centre). */
function segment(r: number, d: number): number {
  if (d <= -r) return 0;
  if (d >= r) return Math.PI * r * r;
  return r * r * Math.acos(-d / r) + d * Math.sqrt(r * r - d * d);
}

/**
 * The salt volume below the world plane y = L inside the jar tilted by a (pivot at the origin of
 * the jar's frame: its base's left edge). Slices along the axis from the floor to the rim.
 */
export function volumeBelow(L: number, a: number): number {
  const s = Math.sin(a);
  const c = Math.cos(a);
  const n = 90;
  const dy = (INNER.rim - INNER.floor) / n;
  let v = 0;
  for (let i = 0; i < n; i++) {
    const y = INNER.floor + (i + 0.5) * dy;
    // world y of (x, y) is x·s + y·c: below L where x·s < L − y·c
    let area: number;
    if (Math.abs(s) < 1e-6) area = y * c < L ? Math.PI * INNER.r * INNER.r : 0;
    else {
      const X = (L - y * c) / s; // the chord's x (jar frame, from the pivot)
      area =
        s > 0 ? segment(INNER.r, X - R) : Math.PI * INNER.r * INNER.r - segment(INNER.r, X - R);
    }
    v += area * dy;
  }
  return v;
}

/** The plane height holding volume V at tilt a (bisection). */
export function levelFor(V: number, a: number): number {
  let lo = -0.25;
  let hi = 0.25;
  for (let i = 0; i < 40; i++) {
    const m = (lo + hi) / 2;
    if (volumeBelow(m, a) < V) lo = m;
    else hi = m;
  }
  return (lo + hi) / 2;
}

/** The rim's lowest point's world height (relative to the pivot) at tilt a. */
const rimLow = (a: number) => {
  const s = Math.sin(a);
  const c = Math.cos(a);
  // the rim circle: x = R + rimR·cosφ; its lowest point is on the side the jar tips to
  return Math.min((R - INNER.rimR) * s, (R + INNER.rimR) * s) + INNER.rim * c;
};

/** The volume the tilted jar can hold (below its rim's lowest point). */
const capacity = (a: number) => volumeBelow(rimLow(a), a);

/** τ: how fast the overhang drains (s); a slower drain leaves more in the jar. */
function flow(v0: number, tau: number) {
  const f0 = POUR.start;
  const df = (POUR.end - POUR.start) / STEPS;
  const dt = df / SEC;
  const volume = new Float32Array(STEPS + 1);
  const q = new Float32Array(STEPS + 1);
  let V = v0;
  for (let i = 0; i <= STEPS; i++) {
    const f = f0 + i * df;
    const over = V - capacity(tiltAt(f));
    // the rate follows the overhang (the salt above the lip): 0 → peak → 0 as the jar
    // tips past it and rights itself
    const rate = over > 0 ? over / tau : 0;
    q[i] = rate;
    volume[i] = V;
    V = Math.max(0, V - rate * dt);
  }
  return { volume, q, vEnd: V, f0, df };
}

export function simulatePour({ x0, grains: count, dust: dustCount }: PourInput): PourResult {
  const v0 = Math.PI * INNER.r * INNER.r * (INNER.fill - INNER.floor);
  // the drain's time constant (what the mouth lets through): set so KEEP stays in the jar
  let lo = 0.01;
  let hi = 60;
  for (let i = 0; i < 30; i++) {
    const m = Math.sqrt(lo * hi);
    if (flow(v0, m).vEnd > v0 * KEEP) hi = m;
    else lo = m;
  }
  const { volume, q, vEnd, f0, df } = flow(v0, Math.sqrt(lo * hi));
  const level = new Float32Array(STEPS + 1);
  for (let i = 0; i <= STEPS; i++) level[i] = levelFor(volume[i]!, tiltAt(f0 + i * df));
  let onset: number = POUR.end;
  let stop: number = POUR.start;
  let qMax = 0;
  for (let i = 0; i <= STEPS; i++)
    if (q[i]! > 0) {
      onset = Math.min(onset, f0 + i * df);
      stop = Math.max(stop, f0 + i * df);
      qMax = Math.max(qMax, q[i]!);
    }
  const poured = v0 - vEnd;
  // poured share by f (cumulative), for the inverse CDF
  const cum = new Float32Array(STEPS + 1);
  for (let i = 1; i <= STEPS; i++) cum[i] = (v0 - volume[i]!) / Math.max(1e-12, poured);
  const emitAt = (u: number) => {
    let a = 0;
    let b = STEPS;
    while (b - a > 1) {
      const m = (a + b) >> 1;
      if (cum[m]! < u) a = m;
      else b = m;
    }
    const k = (u - cum[a]!) / Math.max(1e-9, cum[b]! - cum[a]!);
    return f0 + (a + k) * df;
  };
  const qAt = (f: number) => q[Math.max(0, Math.min(STEPS, Math.round((f - f0) / df)))]!;

  const mx = moundX(x0);
  const coneH = (vol: number) => coneHeight(vol);
  const surface = (x: number, z: number, h: number) =>
    Math.max(0, h - Math.hypot(x - mx, z) * REPOSE);

  const { rnd, gauss } = rng(1311);
  const N = GRAIN.N;
  const out = new Float32Array(count * N);
  const pos = [0, 0, 0];
  const ballistic = (
    t: number,
    sx: number,
    sy: number,
    sz: number,
    vx: number,
    vy: number,
    vz: number,
  ) => {
    const e = (1 - Math.exp(-DRAG * t)) / DRAG;
    pos[0] = sx + vx * e;
    pos[1] = sy + (vy + G / DRAG) * e - (G * t) / DRAG;
    pos[2] = sz + vz * e;
    return pos;
  };
  for (let i = 0; i < count; i++) {
    const o = i * N;
    const u = Math.min(0.9999, (i + rnd()) / count);
    const te = emitAt(u);
    const a = tiltAt(te);
    const s = Math.sin(a);
    const c = Math.cos(a);
    const [px, py] = pivotAt(te, x0);
    // on the lip, around its lowest point: φ = π ± 25° (a wider sheet at a fuller flow)
    const qn = qAt(te) / Math.max(1e-12, qMax);
    const phi = Math.PI + (Math.max(-1, Math.min(1, gauss() * 0.45)) * (25 * Math.PI)) / 180;
    const jx = R + INNER.rimR * Math.cos(phi);
    const jz = INNER.rimR * Math.sin(phi);
    const sx = px + jx * c - INNER.rim * s;
    const sy = py + jx * s + INNER.rim * c;
    const sz = jz;
    // outwards over the lip: the jar's axis (out of the mouth) and the rim's outward normal
    const ax = -s;
    const ay = c;
    const nx = Math.cos(phi) * c;
    const ny = Math.cos(phi) * s;
    const nz = Math.sin(phi);
    const speed = 0.08 + 0.22 * qn + rnd() * 0.05;
    let vx = ax * 0.55 + nx * 0.85;
    let vy = ay * 0.55 + ny * 0.85;
    let vz = nz * 0.85;
    const vl = Math.hypot(vx, vy, vz) || 1;
    vx = (vx / vl) * speed;
    vy = Math.min(0, (vy / vl) * speed) - 0.02; // over the edge: never upwards
    vz = (vz / vl) * speed;
    // land on the cone as it is then (what has landed so far: roughly what left before)
    const hNow = coneH(poured * u * 0.98);
    let t0 = 0;
    let t1 = 2;
    for (let k = 0; k < 36; k++) {
      const m = (t0 + t1) / 2;
      const p = ballistic(m, sx, sy, sz, vx, vy, vz);
      if (p[1]! > surface(p[0]!, p[2]!, hNow)) t0 = m;
      else t1 = m;
    }
    const tl = (t0 + t1) / 2;
    const L = ballistic(tl, sx, sy, sz, vx, vy, vz);
    const lx = L[0]!;
    const ly = L[1]!;
    const lz = L[2]!;
    // its resting place: on the cone it builds (ordered by landing), a few roll to the foot
    const hl = Math.max(hNow, coneH(poured * u));
    const rmax = hl / REPOSE;
    const roll = rnd() < 0.06;
    const rho = roll ? rmax * (1.02 + rnd() * 0.08) : rmax * Math.sqrt(rnd()) * 0.97;
    const ang = Math.atan2(lz, lx - mx) + gauss() * 1.2;
    const rx = mx + Math.cos(ang) * rho;
    const rz = Math.sin(ang) * rho;
    const size = 0.000625 * (1 + (rnd() * 2 - 1) * 0.35);
    const ry = Math.max(size, hl - rho * REPOSE) + size * 0.5;
    out[o + GRAIN.te] = te;
    out[o + GRAIN.tl] = te + tl * SEC;
    out[o + GRAIN.sx] = sx;
    out[o + GRAIN.sy] = sy;
    out[o + GRAIN.sz] = sz;
    out[o + GRAIN.vx] = vx;
    out[o + GRAIN.vy] = vy;
    out[o + GRAIN.vz] = vz;
    out[o + GRAIN.lx] = lx;
    out[o + GRAIN.ly] = ly;
    out[o + GRAIN.lz] = lz;
    out[o + GRAIN.rx] = rx;
    out[o + GRAIN.ry] = ry;
    out[o + GRAIN.rz] = rz;
    out[o + GRAIN.ts] = (roll ? 0.35 : 0.08 + rnd() * 0.1) * SEC;
    out[o + GRAIN.bounce] = rnd() < 0.1 ? 0.002 + rnd() * 0.004 : 0;
    out[o + GRAIN.size] = size;
    out[o + GRAIN.shape] = Math.floor(rnd() * 3);
    out[o + GRAIN.r0] = rnd() * 6;
    out[o + GRAIN.r1] = rnd() * 6;
    out[o + GRAIN.spin] = roll ? 30 + rnd() * 30 : 4 + rnd() * 10;
    out[o + GRAIN.glint] = rnd() < 0.04 ? 1 : 0;
  }

  // dust: a puff at the impacts of random grains, outwards and up, gone in 0.6 s
  const dust = new Float32Array(dustCount * DUST.N);
  for (let i = 0; i < dustCount; i++) {
    const g = Math.floor(rnd() * count) * N;
    const o = i * DUST.N;
    const a = rnd() * Math.PI * 2;
    const sp = 0.02 + rnd() * 0.06;
    dust[o + DUST.t0] = out[g + GRAIN.tl]!;
    dust[o + DUST.x] = out[g + GRAIN.lx]!;
    dust[o + DUST.y] = out[g + GRAIN.ly]!;
    dust[o + DUST.z] = out[g + GRAIN.lz]!;
    dust[o + DUST.vx] = Math.cos(a) * sp;
    dust[o + DUST.vy] = 0.03 + rnd() * 0.05;
    dust[o + DUST.vz] = Math.sin(a) * sp;
    dust[o + DUST.size] = 0.00025 * (0.6 + rnd() * 0.8);
  }

  const levelEnd = levelFor(vEnd, 0);
  return {
    table: { f0, df, level, volume, q },
    onset,
    stop,
    qMax,
    v0,
    vEnd,
    levelEnd,
    mound: { x: mx, hEnd: coneH(poured) },
    grains: out,
    dust,
  };
}

/** A 35° cone holding vol (V = π r² h / 3, h = r·tanφ → h = cbrt(3 V tan²φ / π)). */
export const coneHeight = (vol: number) =>
  Math.cbrt((3 * Math.max(0, vol) * PACK * REPOSE * REPOSE) / Math.PI);

/** The mound's height at f: what had left the jar a moment before (it is in the air between). */
export function moundHeightAt(r: PourResult, f: number): number {
  return coneHeight(r.v0 - tableAt(r.table, r.table.volume, f - 0.25 * SEC));
}

/** The flow at f, 0–1 (the pour-loop's gain, the stream's width). */
export const flowAt = (r: PourResult, f: number) => tableAt(r.table, r.table.q, f) / r.qMax;

/** Linear lookup in a table at f. */
export function tableAt(t: PourResult['table'], arr: Float32Array, f: number): number {
  const x = Math.max(0, Math.min(arr.length - 1, (f - t.f0) / t.df));
  const i = Math.min(arr.length - 2, Math.floor(x));
  return arr[i]! + (arr[i + 1]! - arr[i]!) * (x - i);
}

export { lipAt };
