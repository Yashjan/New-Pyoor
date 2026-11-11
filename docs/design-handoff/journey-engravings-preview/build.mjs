// Journey engravings v2. `node build.mjs` writes 01-brine.svg … 05-jar.svg beside this file.
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Plate, curve, rect, clamp, lerp, inside, W, H, statSync, writeFileSync, join } from '../../../tools/engravings/engrave.mjs';

const here = dirname(fileURLToPath(import.meta.url));

/** A ground plane seen from `eye` metres up, turned by `yaw` degrees: true perspective. */
function ground({ hz, cx = 320, f = 520, eye = 3, yaw = 0 }) {
  const a = (yaw * Math.PI) / 180;
  const cs = Math.cos(a);
  const sn = Math.sin(a);
  const depth = (X, Z) => X * sn + Z * cs;
  const proj = (X, Z) => {
    const z = Math.max(1.5, depth(X, Z));
    return [cx + (f * (X * cs - Z * sn)) / z, hz + (f * eye) / z];
  };
  return { hz, f, eye, proj, depth };
}

/** Pans 11 m wide with a bund between; every third gap is a water channel. */
const COLS = (() => {
  const out = [];
  let x = -176;
  let i = 0;
  while (x < 176) {
    const channel = i % 3 === 2;
    out.push({ x0: x, x1: x + 11, channel, i });
    x += 11 + (channel ? 1.5 : 0.6);
    i++;
  }
  return out;
})();
/** Equal depths, so the rows recede as a true grid. */
const rowsFrom = (start) => {
  const out = [];
  for (let z = start; z < 214; z += 13.2) out.push([z, z + 12.6]);
  return out;
};

/**
 * The grid of rectangular pans, bunds between them. Most pans are bare with a few strokes of
 * brine; some carry a full tone of fine level lines, so the rectangles read as a patchwork.
 */
function pans(P, G, { t = 7, sun, start = 9 } = {}) {
  const pt = G.proj;
  const quad = (a, b, z0, z1) => [pt(a, z0), pt(b, z0), pt(b, z1), pt(a, z1), pt(a, z0)];
  const rows = rowsFrom(start);
  rows.forEach(([z0, z1], r) => {
    const near = r < 1;
    const far = z0 > 60;
    if (far) {
      // too far for double bunds: one long fine line across the whole grid
      P.rule(pt(-176, z0), pt(176, z0), { w: z0 > 130 ? 0.5 : 0.75, t });
      return;
    }
    COLS.forEach((c) => {
      const q = quad(c.x0, c.x1, z0, z1);
      const zm = (z0 + z1) / 2;
      if (near) {
        P.line([q[0], q[1]], { w: r < 1 ? 1.4 : 1.25, t, amp: 0.3 });
        P.line([q[1], q[2]], { w: 1, t, amp: 0.3 });
        P.line([q[2], q[3]], { w: 0.75, t, amp: 0.3 });
        P.line([q[3], q[0]], { w: 1, t, amp: 0.3 });
      } else {
        P.rule(q[0], q[1], { w: r < 5 ? 1 : 0.75, t });
        P.rule(q[1], q[2], { w: 0.75, t });
        P.rule(q[2], q[3], { w: 0.5, t });
        P.rule(q[3], q[0], { w: 0.75, t });
      }
      const lit = (x, y) => (sun ? clamp(1 - Math.abs(x - sun) / (26 + (y - G.hz) * 0.42)) : 0);
      const toned = zm < 56 && (c.i * 7 + r * 5) % 4 === 0;
      if (toned) {
        P.hatch(q, {
          angle: 0,
          gap: clamp(150 / zm, 3, 5.4),
          t: t + 1,
          shared: true,
          jitter: 0.25,
          max: 120,
          shade: (x, y) => 0.75 * (1 - lit(x, y)),
        });
      } else if (zm < 88) {
        // a few short strokes of brine scattered in the pan
        const xs = q.map((v) => v[0]);
        const ys = q.map((v) => v[1]);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);
        const n = Math.round(clamp(150 / zm, 2, 8));
        for (let k = 0; k < n; k++) {
          const x = lerp(minX, maxX, P.rnd());
          const y = lerp(minY, maxY, P.rnd());
          if (!inside(q, [x, y]) || P.rnd() < lit(x, y)) continue;
          const L = 6 + 240 / zm;
          if (inside(q, [x + L, y])) P.rule([x, y], [x + L, y + (P.rnd() - 0.5) * 0.7], { w: 0.5, t: t + 1, prec: 1 });
        }
      }
      if (c.channel && zm < 112) {
        for (const k of [0.3, 0.66]) {
          const X = c.x1 + 1.5 * k;
          P.rule(pt(X, z0), pt(X, z1), { w: 0.5, t: t + 1 });
        }
      }
    });
    // beyond the double bunds, the columns continue as single long lines
    if (r === rows.findIndex(([a]) => a > 60) - 1)
      COLS.forEach((c) => P.rule(pt(c.x0, z1 + 0.3), pt(c.x0, 216), { w: 0.5, t }));
    // the near bunds' shaded flank
    if (r < 2 && rows[r + 1]) {
      const next = rows[r + 1][0];
      const a = pt(-176, z1 + 0.02);
      const b = pt(176, z1 + 0.02);
      const c = pt(176, next - 0.02);
      const d = pt(-176, next - 0.02);
      P.hatch([a, b, c, d, a], { angle: 76, gap: 2.4, t: t + 1, shared: true, shade: (x) => 0.42 + 0.3 * Math.sin(x * 0.04) });
    }
  });
}

/** A salt mound: crest weighted on the shadow side, fine crossed lines only in the shade. */
function mound(P, cx, base, r, h, { t = 4, fine = 2.2 } = {}) {
  const k = P.rnd() * 1.4;
  const pts = [
    [cx - r, base],
    [cx - r * 0.74, base - h * 0.2 - k],
    [cx - r * 0.36, base - h * 0.64],
    [cx - r * 0.08, base - h * 0.97],
    [cx + r * 0.04, base - h],
    [cx + r * 0.2, base - h * 0.8],
    [cx + r * 0.56, base - h * 0.38 + k],
    [cx + r * 0.86, base - h * 0.09],
    [cx + r, base],
  ];
  const top = curve(pts);
  const poly = [...top, top[0]];
  P.line(top, { w: r > 24 ? 1.25 : 0.75, t, swell: r > 24, taper: 'ends' });
  const gap = r > 40 ? fine : fine * 1.25;
  const lit = (x) => (x - cx) / r; // the light is from the left: shade grows to the right
  P.hatch(poly, { angle: 63, gap, t: t + 1, shared: true, shade: (x) => 0.2 + lit(x) * 0.95, over: r > 40 ? (x) => lit(x) > 0.5 : undefined });
  P.hatch(poly, { angle: 118, gap: gap * 1.05, t: t + 1, shared: true, shade: (x) => lit(x) * 1.15 - 0.12 });
  P.block(poly);
}

/** Mounds standing on the ground plane, near ones first so they hide the far ones. */
function moundsOn(P, G, list, o) {
  [...list]
    .sort((u, v) => G.depth(u[0], u[1]) - G.depth(v[0], v[1]))
    .forEach(([X, Z, R, H2]) => {
      const a = G.proj(X, Z);
      const k = G.f / G.depth(X, Z);
      mound(P, a[0], a[1], R * k, H2 * k, o);
    });
}

/** Fine level lines, a few, closing up towards the top; the light stays low at the horizon. */
function sky(P, hz, { t = 9, top = 46 } = {}) {
  P.hatch(rect(24, top, 616, hz - 6), {
    angle: 0,
    gap: 7.4,
    t,
    jitter: 0.4,
    shared: true,
    max: 240,
    shade: (x, y) => ((hz - y) / (hz - top)) ** 1.5 * 0.9 + 0.05 - (Math.abs(x - 320) / 320) ** 3 * 0.55,
  });
}

function horizon(P, hz, gridTop = 19) {
  P.line([[14, hz], [W - 14, hz]], { w: 1, t: 1, amp: 0.2 });
  for (let d = 3.5; d < gridTop; d += 3.2) P.rule([14, hz + d], [W - 14, hz + d], { w: 0.5, t: 8 });
}

/** Maps head-unit figure coordinates (feet at v = 0, crown near v = 7) onto the plate. */
const figure = (x0, y0, s) => (pts) => pts.map(([u, v]) => [x0 + u * s, y0 - v * s]);

function brine() {
  const P = Plate(11);
  const G = ground({ hz: 150, eye: 8, yaw: -11, cx: 330 });
  // ---- the sluice, in the bund at the near pan's front edge ----
  const zGate = 19.4;
  const X = -6.2;
  const footL = G.proj(X - 2.3, zGate);
  const footR = G.proj(X + 2.3, zGate);
  const px = G.f / zGate;
  const hPost = 2.7 * px;
  const post = ([x, y]) => {
    const p = rect(x - 5.5, y - hPost, x + 5.5, y + 5);
    P.line(p, { w: 1.25, t: 2, taper: 'swell', swell: true, amp: 0.15 });
    P.hatch(p, { angle: 90, gap: 1.9, t: 3, shade: (u) => 0.3 + (u - x + 5.5) / 13 });
    P.hatch(p, { angle: 20, gap: 2.3, t: 3, shade: (u, v) => (u - x) / 6 });
    P.block(p);
  };
  post(footL);
  post(footR);
  const beam = [
    [footL[0] - 14, footL[1] - hPost - 8],
    [footR[0] + 14, footR[1] - hPost - 8],
    [footR[0] + 14, footR[1] - hPost + 4],
    [footL[0] - 14, footL[1] - hPost + 4],
    [footL[0] - 14, footL[1] - hPost - 8],
  ];
  P.line(beam, { w: 1.4, t: 2, taper: 'swell', swell: true, amp: 0.15 });
  P.hatch(beam, { angle: 4, gap: 1.9, t: 3, shade: () => 0.7 });
  P.block(beam);
  // the gate, raised: its boards above the opening, water passing beneath
  const ty = footL[1] - hPost + 6;
  const by = footL[1] - hPost * 0.42;
  const gate = [
    [footL[0] + 6, ty],
    [footR[0] - 6, footR[1] - hPost + 6],
    [footR[0] - 6, footR[1] - hPost * 0.42],
    [footL[0] + 6, by],
    [footL[0] + 6, ty],
  ];
  P.line(gate, { w: 0.75, t: 3, taper: false, amp: 0.1 });
  for (let i = 1; i < 7; i++) {
    const x = lerp(footL[0] + 6, footR[0] - 6, i / 7);
    P.line([[x, ty + 0.5], [x + 0.3, by + (footR[1] - footL[1]) * (i / 7) - 0.5]], { w: 0.5, t: 4, taper: false, amp: 0.05 });
  }
  P.hatch(gate, { angle: 88, gap: 1.8, t: 4, shade: (u, v) => (v - ty) / (by - ty) });
  P.hatch(gate, { angle: 14, gap: 2.2, t: 4, shade: (u, v) => (v - ty) / (by - ty) - 0.35 });
  P.block(gate);
  // the opening under the gate: falling water, then a fan of ripples into the near pan
  const open = [
    [footL[0] + 6, by],
    [footR[0] - 6, footR[1] - hPost * 0.42],
    [footR[0] - 6, footR[1]],
    [footL[0] + 6, footL[1]],
    [footL[0] + 6, by],
  ];
  P.hatch(open, { angle: 90, gap: 2.1, t: 4, shade: () => 0.75, jitter: 0.6 });
  P.block(open);
  const gx = (footL[0] + footR[0]) / 2;
  const gy = (footL[1] + footR[1]) / 2;
  for (let i = 1; i <= 7; i++) {
    const rx = 28 + i * 25;
    const ry = 6 + i * 6.4;
    const arc = [];
    for (let k = -1; k <= 1.001; k += 0.08) arc.push([gx + Math.sin(k * 1.35) * rx, gy - 5 - Math.cos(k * 1.35) * ry]);
    P.line(arc, { w: i < 3 ? 1 : 0.75, t: 5, amp: 0.3 });
  }
  // the foreground channel the sluice draws from
  for (let y = gy + 18, g = 6; y < 500; y += g, g += 1.1) P.ripple(30, 610, y, { seg: 22 + (y - gy) * 0.4, t: 7, w: 0.5, swell: y > gy + 70 });
  // the bund the gate stands in
  const bl = G.proj(-90, zGate);
  const br = G.proj(90, zGate);
  const low = (p) => [p[0], p[1] + 11];
  const bund = [bl, br, low(br), low(bl), bl];
  P.line([bl, footL], { w: 1.25, t: 3, amp: 0.3 });
  P.line([footR, br], { w: 1.25, t: 3, amp: 0.3 });
  P.line([low(bl), [footL[0], footL[1] + 11]], { w: 1, t: 3, amp: 0.3 });
  P.line([[footR[0], footR[1] + 11], low(br)], { w: 1, t: 3, amp: 0.3 });
  P.hatch(bund, { angle: 78, gap: 2.1, t: 4, shade: () => 0.8, shared: true });
  P.block(bund);
  pans(P, G, { t: 8, start: 20 });
  horizon(P, G.hz);
  sky(P, G.hz, { top: 40 });
  return P.svg();
}

function sun() {
  const P = Plate(23);
  const hz = 262;
  const cx = 322;
  const cy = 218;
  const R = 40;
  const G = ground({ hz, eye: 6.6, yaw: 9, cx });
  // cross-hatched mounds along the horizon, the sun between them
  for (const [x, r, h] of [[126, 52, 42], [54, 30, 24], [204, 34, 26], [452, 42, 34], [536, 58, 46], [604, 26, 19]]) {
    const pts = curve([[x - r, hz], [x - r * 0.46, hz - h * 0.58], [x - r * 0.07, hz - h], [x + r * 0.1, hz - h * 0.96], [x + r * 0.54, hz - h * 0.42], [x + r, hz]]);
    const poly = [...pts, pts[0]];
    P.line(pts, { w: 1.25, t: 3, swell: true });
    P.hatch(poly, { angle: 60, gap: 2.2, t: 4, shared: true });
    P.hatch(poly, { angle: 120, gap: 2.3, t: 4, shared: true });
    P.block(poly);
  }
  horizon(P, hz);
  // a quiet sun: one fine ring, crossed by level lines of light
  const ring = (r) => Array.from({ length: 121 }, (_, i) => [cx + Math.cos((i / 120) * 6.2832) * r, cy + Math.sin((i / 120) * 6.2832) * r]);
  P.line(ring(R), { w: 0.75, t: 2, amp: 0.1, taper: false });
  P.hatch(ring(R - 1.5), { angle: 0, gap: 3.2, t: 3, jitter: 0.1, shade: (x, y) => (y - (cy - R)) / (2 * R) + 0.2 });
  P.block(ring(R + 2));
  // level light across the sky, longest at the sun's height, fading above it
  for (let y = 118, g = 9; y < hz - 3; y += g, g = Math.max(4.4, g - 0.5)) {
    const k = clamp(1 - Math.abs(y - cy) / 118);
    const half = 40 + k * k * 250 + P.rnd() * 26;
    let x = cx - half;
    while (x < cx + half) {
      const L = 40 + P.rnd() * 140;
      P.rule([x, y], [Math.min(cx + half, x + L), y + (P.rnd() - 0.5) * 0.6], { w: 0.5, t: 5, prec: 2 });
      x += L + 3 + P.rnd() * 10;
    }
  }
  // the pans, with the sun's path left almost bare
  for (let y = hz + 4, g = 5, s; y < 490; y += g, g += 0.7) {
    s = (y - hz) / 230;
    const half = 10 + s * 48;
    P.ripple(cx - half, cx + half, y, { seg: 8 + s * 18, t: 6, w: 0.75 });
  }
  pans(P, G, { t: 7, sun: cx });
  return P.svg();
}

function harvest() {
  const P = Plate(37);
  const hz = 176;
  const G = ground({ hz, eye: 8, yaw: 13, cx: 300 });
  const s = 19; // head height: 7.1 heads = 135 px, 26% of the plate
  const F = figure(452, 428, s);
  const S = (pts, o) => P.shape(F(pts), { w: 1, t: 2, amp: 0.08, ...o });
  // profile, facing left, weight back, drawing a long rake towards him
  const wrap = S([[0, 6.76], [0.06, 7.02], [0.4, 7.2], [0.78, 7.12], [0.98, 6.86], [0.92, 6.68], [0.5, 6.7]], { w: 1 });
  P.hatch(wrap, { angle: 24, gap: 1.5, t: 3, shade: (x) => (x - (452 + 0.2 * s)) / (0.8 * s) + 0.4 });
  P.block(wrap);
  const head = S([[0.05, 6.72], [0.04, 6.42], [0.1, 6.16], [0.32, 6], [0.62, 6.02], [0.86, 6.26], [0.9, 6.68]], { w: 1 });
  P.hatch(head, { angle: 70, gap: 1.5, t: 3, shade: (x) => (x - (452 + 0.5 * s)) / (0.4 * s) });
  P.block(head);
  const arm = S([[0.5, 5.72], [0.06, 5.12], [-0.44, 4.74], [-1, 4.52], [-1.24, 4.44], [-1.24, 4.18], [-0.96, 4.22], [-0.36, 4.4], [0.26, 4.86], [0.86, 5.42]], { w: 1 });
  P.hatch(arm, { angle: 52, gap: 1.5, t: 3, shade: (x, y) => 0.5 });
  P.block(arm);
  const shirt = S([[0.22, 5.98], [-0.05, 5.58], [-0.14, 4.72], [-0.18, 3.72], [-0.3, 3.04], [0.4, 2.94], [1.06, 3.04], [0.92, 3.92], [0.98, 4.82], [0.9, 5.62], [0.62, 5.98]], { w: 1.25 });
  P.hatch(shirt, { angle: 70, gap: 1.6, t: 3, shade: (x) => (x - (452 + 0.3 * s)) / (0.7 * s) + 0.15, over: (x) => x > 452 + 0.7 * s });
  P.hatch(shirt, { angle: 124, gap: 1.8, t: 3, shade: (x) => (x - (452 + 0.6 * s)) / (0.4 * s) });
  P.block(shirt);
  const far = S([[0.3, 5.4], [-0.5, 4.56], [-1.7, 4.14], [-1.92, 4.06], [-1.92, 3.84], [-1.66, 3.86], [-0.46, 4.26], [0.42, 4.9]], { w: 0.75 });
  P.hatch(far, { angle: 40, gap: 1.4, t: 3, shade: () => 0.9 });
  P.block(far);
  const frontLeg = S([[-0.22, 3.04], [-0.6, 2], [-0.96, 1.02], [-0.56, 0.86], [-0.12, 2], [0.38, 3.0]], { w: 1 });
  P.hatch(frontLeg, { angle: 66, gap: 1.6, t: 3, shade: (x) => 0.6 });
  P.block(frontLeg);
  const rearLeg = S([[0.42, 3.0], [0.62, 2], [0.82, 0.92], [1.26, 1.0], [1.42, 2], [1.02, 3.04]], { w: 1 });
  P.hatch(rearLeg, { angle: 72, gap: 1.6, t: 3, shade: (x) => (x - (452 + 0.7 * s)) / (0.6 * s) + 0.3 });
  P.block(rearLeg);
  const shinF = S([[-0.92, 1.02], [-1.08, 0.3], [-1.46, 0.04], [-1.5, -0.05], [-0.84, -0.05], [-0.74, 0.3], [-0.62, 0.94]], { w: 0.75 });
  P.block(shinF);
  const shinR = S([[0.86, 0.96], [0.86, 0.3], [0.56, 0.04], [0.52, -0.05], [1.2, -0.05], [1.22, 0.3], [1.24, 0.98]], { w: 0.75 });
  P.block(shinR);
  // the rake: pole through both hands, a board on edge in the brine
  const [pA] = F([[-0.42, 4.72]]);
  const [pB] = F([[-9.6, 0.12]]);
  P.line([pA, pB], { w: 1, t: 1, amp: 0.25 });
  P.line([[pA[0] + 1, pA[1] + 2], [pB[0] + 1, pB[1] + 2]], { w: 0.5, t: 1, amp: 0.25 });
  const board = F([[-10.7, 0.5], [-8.7, 0.16], [-8.7, -0.34], [-10.7, 0.02], [-10.7, 0.5]]);
  P.line(board, { w: 1.25, t: 2, taper: 'swell', swell: true, amp: 0.1 });
  P.hatch(board, { angle: 170, gap: 1.5, t: 3 });
  P.block(board);
  // his faint reflection, and the furrow the rake leaves
  const flip = F([[-1.5, 0], [1.5, 0], [1.1, -3.4], [0.5, -6.2], [-0.2, -6.2], [-0.5, -3.4], [-1.5, 0]]).map(([x, y]) => [x, 428 + (y - 428) * 0.8]);
  P.hatch(flip, { angle: 0, gap: 2.7, t: 6, opacity: 0.7, max: 13, shade: (x, y) => 1 - (y - 428) / 110 });
  P.block(flip);
  for (let i = 0; i < 5; i++) {
    const y = 433 + i * 6;
    P.ripple(232 + i * 8, 420 - i * 3, y, { seg: 24, t: 5, w: 0.5 });
  }
  mound(P, 548, 440, 44, 74, { t: 4 });
  moundsOn(P, G, [[-2.5, 44, 5.6, 6.8], [16, 66, 7, 8.4], [-30, 84, 8, 9.6], [44, 104, 9, 11]], { t: 4 });
  pans(P, G, { t: 7 });
  horizon(P, hz);
  sky(P, hz, { top: 44 });
  return P.svg();
}

function carry() {
  const P = Plate(53);
  const hz = 180;
  const G = ground({ hz, eye: 8, yaw: -14, cx: 340 });
  const s = 16.5; // 7 heads = 115 px of woman; with the load 146 px, 28.5% of the plate
  const fx = 246;
  const fy = 432;
  const F = figure(fx, fy, s);
  const sil = [];
  const S = (pts, o) => {
    const p = P.shape(F(pts), { w: 1, t: 2, amp: 0.08, ...o });
    sil.push(p);
    return p;
  };
  // the load: a low rounded heap in a shallow basket, resting ON her head
  const heap = S([[-1, 7.92], [-0.76, 8.34], [-0.3, 8.7], [0.3, 8.86], [0.9, 8.72], [1.4, 8.34], [1.6, 7.92]], { w: 1.25 });
  P.hatch(heap, { angle: 60, gap: 1.6, t: 3, shade: (x) => (x - (fx - 0.2 * s)) / (1.7 * s) + 0.1, over: (x) => x > fx + 0.9 * s });
  P.hatch(heap, { angle: 120, gap: 1.7, t: 3, shade: (x) => (x - (fx + 0.6 * s)) / (1 * s) });
  P.block(heap);
  const basket = S([[-1.26, 7.86], [-0.9, 7.4], [-0.3, 7.16], [0.3, 7.1], [0.9, 7.16], [1.5, 7.4], [1.86, 7.86], [1.2, 7.94], [0.3, 7.96], [-0.6, 7.94]], { w: 1.25 });
  for (let i = -6; i <= 6; i++) {
    const [a, b] = F([[0.3 + i * 0.25, 7.92], [0.3 + i * 0.19, 7.14 + Math.abs(i) * 0.02]]);
    P.line([a, b], { w: 0.5, t: 3, taper: false, amp: 0.02 });
  }
  P.hatch(basket, { angle: 0, gap: 2.1, t: 3, shade: (x) => (x - fx) / (1.6 * s) + 0.5 });
  P.block(basket);
  // the cloth ring between basket and head
  const ring = S([[-0.2, 7], [0.3, 7.14], [0.82, 7], [0.82, 6.92], [0.3, 6.84], [-0.2, 6.92]], { w: 0.75 });
  P.block(ring);
  // near arm raised to the basket's front rim
  const arm = S([[0.62, 5.72], [0.1, 5.98], [-0.42, 6.34], [-0.78, 6.86], [-0.92, 7.3], [-1.18, 7.3], [-1.04, 6.74], [-0.66, 6.04], [-0.14, 5.56], [0.46, 5.3]], { w: 1 });
  P.hatch(arm, { angle: 60, gap: 1.5, t: 3, shade: () => 0.5 });
  P.block(arm);
  // the head, clearly under the basket: the dupatta over her hair, the face left plain
  const head = S([[0.02, 6.86], [0, 6.5], [0.08, 6.2], [0.3, 6], [0.6, 6.02], [0.82, 6.24], [0.86, 6.62], [0.72, 6.88]], { w: 1 });
  P.block(head);
  // the dupatta, from the crown down her back, ending in a lifted corner
  const dup = S([[0.4, 6.9], [0.86, 6.82], [1, 6.3], [1.06, 5.6], [1.22, 4.2], [1.56, 2.8], [1.94, 2.04], [1.7, 1.84], [1.2, 2.1], [0.84, 3.2], [0.7, 4.8], [0.62, 5.8], [0.5, 6.4]], { w: 1.25 });
  P.hatch(dup, { angle: 72, gap: 1.4, t: 3, shade: (x, y) => (x - (fx + (0.7 + (fy - y) * -0.0) * s)) / (0.5 * s) + 0.5 });
  P.hatch(dup, { angle: 128, gap: 1.6, t: 3, shade: (x) => (x - (fx + 0.95 * s)) / (0.45 * s) });
  P.block(dup);
  // the far arm, swinging forward
  const armF = S([[0.32, 5.42], [-0.06, 4.6], [-0.3, 3.8], [-0.3, 3.52], [-0.08, 3.5], [0.1, 3.84], [0.38, 4.54], [0.62, 5.1]], { w: 0.75 });
  P.hatch(armF, { angle: 68, gap: 1.4, t: 3, shade: () => 0.8 });
  P.block(armF);
  const bodice = S([[0.18, 6.02], [0.08, 5.62], [0.12, 4.38], [0.88, 4.34], [0.78, 5.72], [0.56, 6.02]], { w: 1 });
  P.hatch(bodice, { angle: 64, gap: 1.5, t: 3, shade: (x) => (x - (fx + 0.45 * s)) / (0.45 * s) });
  P.block(bodice);
  const skirt = S([[0.1, 4.4], [-0.26, 3.2], [-0.8, 1.4], [-1.06, 0.26], [-0.6, 0], [0.4, -0.06], [1.36, 0], [1.6, 0.36], [1.36, 1.4], [1.06, 3], [0.88, 4.4]], { w: 1.25 });
  P.hatch(skirt, { angle: 80, gap: 1.6, t: 3, shade: (x, y) => (x - (fx + 0.5 * s)) / (0.9 * s) + 0.12, over: (x) => x > fx + 1.1 * s });
  P.hatch(skirt, { angle: 112, gap: 1.9, t: 3, shade: (x) => (x - (fx + 0.95 * s)) / (0.6 * s) });
  for (const c of [[[0.2, 4.2], [-0.2, 2.2], [-0.72, 0.3]], [[0.42, 4.2], [0.3, 2.2], [0.16, 0.04]], [[0.64, 4.2], [0.8, 2.2], [0.96, 0.04]]]) P.curve(F(c), { w: 0.5, t: 3, amp: 0.05 });
  P.block(skirt);
  const foot = S([[-1.04, 0.2], [-1.46, 0], [-1.52, -0.08], [-0.82, -0.1], [-0.68, 0.14]], { w: 0.75 });
  P.block(foot);
  // her reflection: level strokes inside her flipped outline, kept clear of the ripples
  const reflect = sil.map((p) => p.map(([x, y]) => [x, fy + (fy - y) * 0.42]));
  for (const p of reflect) P.hatch(p, { angle: 0, gap: 2.4, t: 6, opacity: 0.62, jitter: 0.5, max: 16, shade: (x, y) => 1.05 - (y - fy) / 90 });
  for (const p of reflect) P.block(p);
  for (const [x, y, L] of [[196, 436, 30], [282, 438, 36], [190, 444, 28], [296, 446, 44]]) P.ripple(x, x + L, y, { seg: 12, t: 5, w: 0.75 });
  mound(P, 432, 392, 56, 84, { t: 4 });
  moundsOn(P, G, [[20, 62, 7, 8.4], [-16, 72, 7.4, 8.8], [46, 96, 9, 10.8], [-46, 104, 9, 11]], { t: 4 });
  pans(P, G, { t: 7 });
  horizon(P, hz);
  sky(P, hz, { top: 44 });
  return P.svg();
}

function jar() {
  const P = Plate(71, { vignette: false });
  // proportions from the 3D model: width 10, height 12.2; widths and bands measured off it
  const cx = 320;
  const jw = 122; // half the width
  const J = 2 * jw;
  const y0 = 70; // cap top
  const Y = (v) => y0 + v * J; // v in jar widths, 0 at the cap top, 1.22 at the foot
  const capB = Y(0.176);
  const saltT = Y(0.222);
  const labT = Y(0.29);
  const labB = Y(1.044);
  const foot = Y(1.22);
  const bow = (y, b = 4) => curve([[cx - jw, y], [cx - jw * 0.5, y + b * 0.75], [cx, y + b], [cx + jw * 0.5, y + b * 0.75], [cx + jw, y]], false, 3);
  // the small heap of black salt the jar stands in: an uneven crest, fine crossed lines
  const crest = curve([[92, 474], [122, 452], [148, 438], [172, 404], [188, 368], [214, 358], [262, 358], [320, 361], [378, 358], [426, 358], [452, 368], [468, 404], [492, 438], [518, 452], [548, 474]], false, 6);
  const jag = crest.map((q) => [q[0] + (P.rnd() - 0.5) * 1.6, q[1] + (P.rnd() - 0.5) * 3.6]);
  P.line(jag, { w: 1.25, t: 3, amp: 0, swell: true });
  const hp = [...crest, [548, 482], [92, 482], crest[0]];
  P.hatch(hp, { angle: 60, gap: 2.6, t: 4, shared: true, shade: (x, y) => 0.05 + (y - 364) / 120 + (x - 320) / 280, over: (x, y) => x > 370 && y > 430 });
  P.hatch(hp, { angle: 122, gap: 2.4, t: 5, shared: true, shade: (x, y) => (y - 410) / 70 + (x - 370) / 190 });
  for (let i = 0; i < 16; i++) {
    const x = 130 + P.rnd() * 380;
    const y = 412 + P.rnd() * 60;
    const r = 1.6 + P.rnd() * 3;
    P.line([[x - r, y], [x - r * 0.1, y - r * 1.2], [x + r, y - r * 0.2], [x + r * 0.2, y + r * 0.7], [x - r, y]], { w: 0.5, t: 6, amp: 0, taper: false });
  }
  P.block(hp);
  // the smooth cap: nearly the jar's full width, two fine grooves, no ribs
  const capPoly = [
    ...curve([[cx - jw - 1, y0 + 10], [cx - jw + 1, y0 + 4], [cx - jw + 8, y0 + 1]], false, 1.5),
    ...curve([[cx - jw + 8, y0 + 1], [cx, y0 - 1], [cx + jw - 8, y0 + 1]], false, 6),
    ...curve([[cx + jw - 8, y0 + 1], [cx + jw - 1, y0 + 4], [cx + jw + 1, y0 + 10]], false, 1.5),
    [cx + jw + 1, capB - 7],
    ...curve([[cx + jw + 1, capB - 7], [cx + jw - 2, capB - 2], [cx + jw - 9, capB]], false, 1.5),
    ...curve([[cx + jw - 9, capB], [cx, capB + 4], [cx - jw + 9, capB]], false, 6),
    ...curve([[cx - jw + 9, capB], [cx - jw + 2, capB - 2], [cx - jw - 1, capB - 7]], false, 1.5),
    [cx - jw - 1, y0 + 10],
  ];
  P.line(capPoly, { w: 1.4, t: 2, amp: 0.08, taper: 'swell', swell: true });
  for (const v of [0.082, 0.118]) P.line(bow(Y(v), 3), { w: 0.5, t: 3, taper: 'ends', amp: 0.05 });
  P.hatch(capPoly, { angle: 90, gap: 2, t: 3, shade: (x) => (x - (cx + 74)) / 44 + 0.08, over: (x) => x > cx + jw - 16 });
  P.hatch(capPoly, { angle: 90, gap: 2.6, t: 3, shade: (x) => (cx - 102 - x) / 24 });
  P.block(capPoly);
  // the label band: arched crest hanging from its top edge (empty), two gold rules
  const top = bow(labT, 4);
  const bot = bow(labB, 4);
  P.line(top, { w: 1, t: 3, amp: 0.1, taper: false });
  P.line(bot, { w: 1, t: 3, amp: 0.1, taper: false });
  const yc = (x) => labT + 4 * (1 - ((x - cx) / jw) ** 2) * 0.96;
  const crown = (d) => {
    const hw = 41 - d;
    const b = Y(0.5) - d;
    return curve([
      [cx - hw, yc(cx - hw) + (d ? 0.5 : 0)],
      [cx - hw, b - 12],
      [cx - hw + 10, b - 4],
      [cx - 16, b - 7],
      [cx - 6, b + 1],
      [cx, b + 7],
      [cx + 6, b + 1],
      [cx + 16, b - 7],
      [cx + hw - 10, b - 4],
      [cx + hw, b - 12],
      [cx + hw, yc(cx + hw) + (d ? 0.5 : 0)],
    ], false, 2);
  };
  P.line(crown(0), { w: 1, t: 4, amp: 0.06, taper: false });
  P.line(crown(4), { w: 0.5, t: 4, amp: 0.06, taper: false });
  for (const sign of [-1, 1]) {
    // the gold rules: outer top to inner foot of the label, as on the jar
    const a = [cx + sign * jw * 0.88, yc(cx + sign * jw * 0.88)];
    const b = [cx + sign * jw * 0.4, labB + 3.5];
    P.line([a, b], { w: 1.25, t: 4, amp: 0.08, taper: false });
    P.line([[a[0] + sign * 5, a[1]], [b[0] + sign * 5, b[1]]], { w: 0.5, t: 4, amp: 0.08, taper: false });
  }
  const lab = [...top, ...bot.slice().reverse(), top[0]];
  P.hatch(lab, { angle: 90, gap: 2, t: 5, shade: (x) => (x - (cx + 84)) / 38 + 0.05, over: (x) => x > cx + jw - 14 });
  P.hatch(lab, { angle: 90, gap: 2.6, t: 5, shade: (x) => (cx - 104 - x) / 22 });
  P.hatch(lab, { angle: 34, gap: 2.2, t: 5, shade: (x) => (x - (cx + 100)) / 24 });
  P.block(lab.map(([x, y]) => [cx + (x - cx) * 0.99, y]));
  // the clear jar: rounded shoulder and foot
  const body = curve([[cx - jw + 8, capB + 1], [cx - jw + 1, capB + 8], [cx - jw, capB + 22], [cx - jw, Y(0.6)], [cx - jw, foot - 18], [cx - jw + 3, foot - 7], [cx - jw + 14, foot], [cx, foot + 6], [cx + jw - 14, foot], [cx + jw - 3, foot - 7], [cx + jw, foot - 18], [cx + jw, Y(0.6)], [cx + jw, capB + 22], [cx + jw - 1, capB + 8], [cx + jw - 8, capB + 1]]);
  P.line(body, { w: 1.4, t: 2, amp: 0.1, taper: false, swell: true });
  // the salt, seen above and below the label: dense fine grain, level strokes in the shade
  const saltTop = bow(saltT, 5);
  P.line(saltTop.map(([x, y]) => [cx + (x - cx) * 0.96, y]), { w: 0.75, t: 4, amp: 0.25 });
  const bandUp = [[cx - jw + 5, saltT + 1], [cx + jw - 5, saltT + 1], [cx + jw - 5, labT + 4], [cx - jw + 5, labT + 4], [cx - jw + 5, saltT + 1]];
  const bandDown = [[cx - jw + 5, labB + 5], [cx + jw - 5, labB + 5], [cx + jw - 5, foot - 3], [cx - jw + 5, foot - 3], [cx - jw + 5, labB + 5]];
  for (const b of [bandUp, bandDown]) {
    P.hatch(b, { angle: 0, gap: 2.9, t: 5, max: 3.5, jitter: 0.9, shared: true, shade: () => P.rnd() * 0.42 });
    P.hatch(b, { angle: 60, gap: 2.4, t: 5, shared: true, shade: (x) => (x - (cx + 76)) / 46 });
  }
  const bp = [...body, body[0]];
  P.hatch([[cx + jw - 12, capB + 2], [cx + jw - 1, capB + 2], [cx + jw - 1, saltT + 2], [cx + jw - 12, saltT + 2], [cx + jw - 12, capB + 2]], { angle: 90, gap: 1.9, t: 5 });
  P.block(bp);
  P.line([[60, 490], [580, 490]], { w: 0.5, t: 8, amp: 0.4 });
  return P.svg();
}

let total = 0;
for (const [name, fn] of [['01-brine', brine], ['02-sun', sun], ['03-harvest', harvest], ['04-carry', carry], ['05-jar', jar]]) {
  const f = join(here, name + '.svg');
  writeFileSync(f, fn());
  const kb = statSync(f).size / 1024;
  total += kb;
  console.log(name, kb.toFixed(1) + ' KB');
}
console.log('total', total.toFixed(1), 'KB');
