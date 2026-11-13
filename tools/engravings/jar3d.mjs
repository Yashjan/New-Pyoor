// The scene 05 jar, projected from the 3D model with the hero's own camera at the first frame
// of the jar sequence (components/hero/scene/camera.ts K[0], layout.ts, jar.ts), so the
// engraving's lines sit on the 3D jar's outline when one hands over to the other.
//
// The jar is a solid of revolution (tools/3d/build_jar.py): its outline is read from the
// uncompressed source GLB's vertices, its key edges (cap rim, cap bottom, shoulder, label
// edges, base) are horizontal circles at the model's own heights.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const GLB = join(here, '../3d/source/pyoor-herbal-black-salt.glb');

/** The hero camera at p = 0 (desktop, 1440 × 900, after the opening's glide). */
// (lib/motion/heroCamera.ts: fov 24°, the p = 0 key [0, .1, .62] → [0, .07, 0] pulled back by
// tan 15° / tan 12° so the jar keeps its size)
const LENS = Math.tan((15 * Math.PI) / 180) / Math.tan((12 * Math.PI) / 180);
export const CAM = {
  fov: 24,
  width: 1440,
  height: 900,
  pos: [0, 0.07 + 0.03 * LENS, 0.62 * LENS],
  look: [0, 0.07, 0],
  /** jar x at p = 0: layout.jx (0.13) × 0.558 (restX); the camera follows it by 10% */
  jarX: 0.13 * 0.558,
  /** the idle float's resting height (jar.ts: 0.006 + sin(t) × 0.004, held still at the handoff) */
  jarY: 0.006,
};

export function readGlb(file = GLB) {
  const b = readFileSync(file);
  const jsonLen = b.readUInt32LE(12);
  const json = JSON.parse(b.subarray(20, 20 + jsonLen).toString());
  const binStart = 20 + jsonLen + 8;
  const positions = (name) => {
    const mesh = json.meshes.find((m) => m.name === name);
    const acc = json.accessors[mesh.primitives[0].attributes.POSITION];
    const view = json.bufferViews[acc.bufferView];
    const off = binStart + (view.byteOffset ?? 0) + (acc.byteOffset ?? 0);
    const stride = view.byteStride ?? 12;
    const out = [];
    for (let i = 0; i < acc.count; i++)
      out.push([0, 4, 8].map((k) => b.readFloatLE(off + i * stride + k)));
    return out;
  };
  return { positions };
}

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const norm = (a) => {
  const l = Math.hypot(...a);
  return a.map((v) => v / l);
};

/** A three.js-style perspective camera (lookAt, vertical fov) as a projection to pixels. */
export function camera({ fov, width, height, pos, look, jarX }) {
  const shift = jarX * 0.1;
  const P = [pos[0] + shift, pos[1], pos[2]];
  const T = [look[0] + shift, look[1], look[2]];
  const f = norm(sub(T, P));
  const r = norm(cross(f, [0, 1, 0]));
  const u = cross(r, f);
  const t = Math.tan((fov * Math.PI) / 360);
  const aspect = width / height;
  return {
    P,
    project(q) {
      const d = sub(q, P);
      const z = dot(d, f);
      return [
        ((dot(d, r) / (z * t * aspect) + 1) / 2) * width,
        ((1 - dot(d, u) / (z * t)) / 2) * height,
      ];
    },
  };
}

/** Convex hull (monotone chain), counter-clockwise. */
function hull(pts) {
  const p = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const c = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [];
  for (const q of p) {
    while (lo.length >= 2 && c(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop();
    lo.push(q);
  }
  const up = [];
  for (const q of p.reverse()) {
    while (up.length >= 2 && c(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop();
    up.push(q);
  }
  return [...lo.slice(0, -1), ...up.slice(0, -1)];
}

/**
 * The jar in screen pixels (canonical 1440 × 900): its outline, the visible (front) half of each
 * key edge, and the two anchors the page aligns it by (base centre, cap-top centre).
 */
export function projectJar() {
  const glb = readGlb(GLB);
  const cam = camera(CAM);
  const at = ([x, y, z]) => cam.project([x + CAM.jarX, y + CAM.jarY, z]);
  const outer = ['Body', 'Lid', 'Lid_rim'].flatMap((n) => glb.positions(n));
  const radius = (name, y0, y1) =>
    Math.max(
      ...glb
        .positions(name)
        .filter(([, y]) => y >= y0 && y <= y1)
        .map(([x, , z]) => Math.hypot(x, z)),
    );
  const ys = (name) => glb.positions(name).map((q) => q[1]);
  const lidY0 = Math.min(...ys('Lid'));
  const lidY1 = Math.max(...ys('Lid_rim'));
  const labelY0 = Math.min(...ys('Label'));
  const labelY1 = Math.max(...ys('Label'));
  // the shoulder: the highest point where the wall is still at its full radius
  const rBody = radius('Body', 0, 0.2);
  const shoulderY = Math.max(
    ...glb
      .positions('Body')
      .filter(([x, , z]) => Math.hypot(x, z) > rBody - 0.0002)
      .map((q) => q[1]),
  );
  const baseY = 0.006; // where the base starts to round under
  const rLid = radius('Lid', lidY0, lidY1);
  const rLabel = radius('Label', labelY0, labelY1);
  const eye = sub(cam.P, [CAM.jarX, 0, 0]);
  /** The front half of the circle (radius r at height y) as the camera sees it. */
  const arc = (y, r) => {
    const pts = [];
    for (let i = 0; i <= 180; i++) {
      const a = (i / 180) * Math.PI * 2;
      const n = [Math.sin(a), 0, Math.cos(a)];
      const q = [n[0] * r, y + CAM.jarY, n[2] * r];
      if (dot(n, sub(eye, q)) > 0) pts.push({ a, p: at([n[0] * r, y, n[2] * r]) });
    }
    // order left to right on screen
    return pts.map((o) => o.p).sort((u, v) => u[0] - v[0]);
  };
  return {
    outline: hull(outer.map(at)),
    edges: {
      capRim: arc(lidY1 - 0.0024, rLid),
      capGroove: arc(lidY0 + 0.0058, rLid - 0.0004),
      capBottom: arc(lidY0, rLid),
      shoulder: arc(shoulderY, rBody),
      labelTop: arc(labelY1, rLabel),
      labelBottom: arc(labelY0, rLabel),
      base: arc(baseY, rBody),
    },
    heights: { lidY0, lidY1, labelY0, labelY1, shoulderY },
    anchors: { base: at([0, 0, 0]), top: at([0, lidY1, 0]) },
  };
}
