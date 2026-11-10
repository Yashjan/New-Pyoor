import {
  Color,
  DynamicDrawUsage,
  Euler,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  Quaternion,
  Vector3,
} from 'three';
import { createRng, smooth } from './math';

/**
 * The pour. Every grain's whole life is computed once (emission time, landing spot on the heap,
 * its place on the salt flat); each frame only evaluates those paths at progress p.
 * No physics, no state between frames, so the same p always gives the same picture, and
 * scrolling back up reverses it exactly.
 */

interface Grain {
  te: number; // emission time (progress)
  lx: number; // landing spot on the heap
  ly: number;
  lz: number;
  sx: number; // spot on the salt flat
  sz: number;
  jx: number; // sideways jitter in flight
  jz: number;
  s: number; // size (m)
  rx: number; // base rotation
  ry: number;
  spin: number; // tumbles in flight
}

/** Progress spent in the air by each grain. */
const FLIGHT = 0.045;

/** Black-salt colours, matched to the product photo: grey-brown with a red-brown minority. */
const BASE = new Color('#6a5649');
const DARK = new Color('#3e2a22');
const LIGHT = new Color('#8c7c74');
const RED = new Color('#80524a');
/** Share of grains that lean red-brown. */
const RED_SHARE = 0.15;

export function createGrainMesh(count: number, castShadow: boolean): InstancedMesh {
  const mesh = new InstancedMesh(
    new IcosahedronGeometry(1, 0),
    new MeshStandardMaterial({ color: 0xffffff, roughness: 0.24, metalness: 0, flatShading: true }),
    count,
  );
  mesh.instanceMatrix.setUsage(DynamicDrawUsage);
  mesh.castShadow = castShadow;
  mesh.frustumCulled = false;
  return mesh;
}

/** Precomputes every grain's path for a given mouth position. Seeded: always the same pour. */
export function buildGrains(mesh: InstancedMesh, mouth: Vector3): Grain[] {
  const { rnd, gauss } = createRng(11);
  const count = mesh.count;
  const heap = new Vector3(mouth.x - 0.012, 0, mouth.z);
  const grains: Grain[] = [];
  // Colours come from their own seeded stream so the pour paths don't depend on them.
  const tint = createRng(29).rnd;
  const c = new Color();

  for (let i = 0; i < count; i++) {
    const u = i / count;
    const te = 0.44 + u * 0.27 + rnd() * 0.012; // emission time within the pour window
    const r = Math.abs(gauss()) * 0.026 * (0.45 + 0.75 * u); // later grains land wider
    const a = rnd() * Math.PI * 2;
    const lx = heap.x + Math.cos(a) * r;
    const lz = heap.z + Math.sin(a) * r * 0.9;
    const hMax = 0.034 * Math.min(1, 0.25 + u); // the heap grows as the pour goes on
    const ly = hMax * Math.exp(-(r * r) / (2 * 0.019 * 0.019)) + rnd() * 0.0015;
    const sp = 2.2 + rnd() * 6.5; // spread for the salt-flat stage
    const s = 0.0007 + rnd() * 0.0011;
    c.copy(BASE).lerp(tint() < 0.5 ? DARK : LIGHT, tint() * 0.8);
    const lean = tint();
    const redness = 0.4 + tint() * 0.4;
    if (lean < RED_SHARE) c.lerp(RED, redness);
    mesh.setColorAt(i, c);
    grains.push({
      te,
      lx,
      ly,
      lz,
      sx: heap.x + Math.cos(a) * (r * 9 + sp * 0.06),
      sz: heap.z + Math.sin(a) * (r * 9 + sp * 0.06) * 0.7,
      jx: (rnd() - 0.5) * 0.004,
      jz: (rnd() - 0.5) * 0.004,
      s,
      rx: rnd() * 6,
      ry: rnd() * 6,
      spin: 4 + rnd() * 10,
    });
  }
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  return grains;
}

const m4 = new Matrix4();
const q = new Quaternion();
const e3 = new Euler();
const v3 = new Vector3();
const sc = new Vector3();

/** Places every grain for progress p. Pure function of p, the grain table and the mouth. */
export function updateGrains(
  mesh: InstancedMesh,
  grains: readonly Grain[],
  mouth: Vector3,
  p: number,
): void {
  const spread = smooth(0.76, 0.95, p);
  // HANDOFF to-do: spread grains fade a little sooner (.78–.88, was .8–.93).
  const fade = 1 - smooth(0.78, 0.88, p);

  for (let i = 0; i < grains.length; i++) {
    const g = grains[i]!;
    let x: number;
    let y: number;
    let z: number;
    let s = g.s;
    let rot = 0;

    if (p < g.te) {
      s = 0; // still in the jar
      x = mouth.x;
      y = mouth.y;
      z = mouth.z;
    } else if (p < g.te + FLIGHT) {
      const k = (p - g.te) / FLIGHT;
      x = mouth.x + (g.lx - mouth.x) * k + g.jx * k;
      z = mouth.z + (g.lz - mouth.z) * k + g.jz * k;
      y = mouth.y + (g.ly - mouth.y) * k * k; // falls under gravity
      rot = k * g.spin;
    } else {
      x = g.lx;
      y = g.ly;
      z = g.lz;
    }

    if (spread > 0 && p >= g.te) {
      x += (g.sx - x) * spread;
      z += (g.sz - z) * spread;
      y *= 1 - spread * 0.97;
      s *= fade;
    }

    e3.set(g.rx + rot, g.ry + rot * 0.6, 0);
    q.setFromEuler(e3);
    m4.compose(v3.set(x, y, z), q, sc.set(s, s * 0.8, s));
    mesh.setMatrixAt(i, m4);
  }
  mesh.instanceMatrix.needsUpdate = true;
}
