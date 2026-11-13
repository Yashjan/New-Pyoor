// Step 3, the pink salt pans (components/sections/SaltPans): a high-angle view of the pan field,
// engraved in gold, with the colour, crust and glints the page animates. Seeded: repeatable.
//   npm run engravings   (build.mjs calls buildPans)
// Writes public/engravings/pans-wide.svg (landscape) and pans-tall.svg (portrait: the same field
// from a narrower view, ~55% of the pans). The static file is the scene's end state (fully
// drawn and coloured): the page shows it as an <img> under reduced motion, and inlines it to
// animate otherwise.
//
// The field's far edge is the gold horizon line (y = HZ): the 3D scene's horizon lands exactly
// there at the end of its rise (lib/motion/pans.ts), and the page places the SVG so it does.
//
// Structure (what the page animates):
//   <g data-cam="">                       the settle's glide into one pan (transform)
//     <g data-colour="">                  per pan: g.pn[data-o][data-k] (clip: the pan)
//       rect.w / rect.k / rect.kd      water / pink / deep bands (translate: the spread)
//       path.cr[data-s0][data-c]       the white crust (scale about the pan: grows inward)
//       g.sh > path                    the brine's shimmer lines (opacity, CSS)
//     path.hz                          the horizon (far edge)
//     <g data-lines=""> g[data-s="stage.ring(.fN)"]   the engraving, drawn by stroke-dashoffset
//                                       stages: 1 canal, 2 bunds, 3 pans, 4 mounds,
//                                       5 figures, 6 hatching; rings from the centre outward
//     path.bz                          breezes over the canal water
//     <g data-glints=""> g.gl[data-o]     4-point glints on the mounds and the crust
import {
  Plate,
  clamp,
  curve,
  inside,
  lerp,
  mound,
  here,
  join,
  statSync,
  writeFileSync,
} from './engrave.mjs';

const OUT = join(here, '../../public/engravings');

/** The field, in plan: x across, z the distance from the eye (the near edge at 1, the far at 2). */
const ZN = 1;
const ZF = 2;
const BUND = 0.022; // across (a bund between neighbouring pans)
const BUNDZ = 0.011; // in depth (foreshortened: a row's bund)
const CANAL = 0.085;
const canalX = (z) => -0.38 - 0.06 * (z - 1) + 0.025 * Math.sin(5.2 * z);

const VARIANTS = {
  // HZ leaves room above the line for the far mound (the 3D mound's place at the hand-over)
  wide: { W: 1600, H: 900, HZ: 48, F: 654, mound: [58, 33], mounds: 5, figures: 3, glints: 16 },
  tall: { W: 800, H: 1300, HZ: 76, F: 560, mound: [100, 57], mounds: 4, figures: 2, glints: 10 },
};
const COLOURS = { w: '#e9e6dc', k: '#d98f8a', kd: '#c97a78' };
const SOFT = { w: 40, k: 150 }; // the spreading edge, user units

function RNG(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The plan: rows (far to near) of irregular pans either side of the feeder canal. */
function plan() {
  const rnd = RNG(4242);
  const rows = [];
  let zb = ZF - 0.006;
  while (zb > 0.66) {
    const depth = 0.1 + rnd() * 0.055;
    rows.push([zb - depth, zb]);
    zb -= depth + BUNDZ;
  }
  // shared column boundaries per side (from the canal outwards), jittered per row
  const side = () => {
    const out = [0];
    let x = 0;
    while (x < 3.4) {
      x += 0.46 + rnd() * 0.3;
      out.push(x);
    }
    return out;
  };
  const cols = { l: side(), r: side() };
  const pans = [];
  rows.forEach(([z0, z1], r) => {
    for (const s of ['l', 'r']) {
      const sign = s === 'l' ? -1 : 1;
      const b = cols[s].map((x, i) => (i ? x + (rnd() - 0.5) * 0.08 : x));
      for (let i = 0; i + 1 < b.length; i++) {
        let j = i + 1;
        if (rnd() < 0.22 && j + 1 < b.length) j++; // a long pan: two columns as one
        const off = (z) => canalX(z) + sign * (CANAL / 2 + BUND);
        const a0 = b[i] + (i ? BUND / 2 : 0);
        const a1 = b[j] - BUND / 2;
        const jt = () => (rnd() - 0.5) * 0.014;
        const corner = (a, z) => [off(z) + sign * a + jt(), z + jt() * 0.4];
        // near-left, near-right, far-right, far-left (screen order)
        let q = [corner(a0, z0), corner(a1, z0), corner(a1, z1), corner(a0, z1)];
        if (sign < 0) q = [q[1], q[0], q[3], q[2]];
        pans.push({ q, row: r, side: s, dist: (a0 + a1) / 2, i: pans.length });
        i = j - 1;
      }
    }
  });
  // kinds: 15% fresh brine (stay pale), 15% deeper pink, the rest Sambhar pink
  for (const p of pans) {
    const v = rnd();
    p.kind = v < 0.15 ? 'f' : v < 0.3 ? 'd' : 'p';
    p.jit = rnd();
  }
  return { rows, pans, rnd };
}

const r1 = (v) => Math.round(v * 10) / 10;
const r2 = (v) => Math.round(v * 2) / 2;
const polyD = (pts, round = r1) =>
  'M' + pts.map(([x, y]) => `${round(x)} ${round(y)}`).join('L') + 'Z';
const star = (x, y, r, waist = 0.24) => {
  const q = r * waist;
  const p = [
    [x, y - r],
    [x + q, y - q],
    [x + r, y],
    [x + q, y + q],
    [x, y + r],
    [x - q, y + q],
    [x - r, y],
    [x - q, y - q],
  ];
  return polyD(p, (v) => Math.round(v * 100) / 100);
};
const centroid = (q) => [
  q.reduce((s, p) => s + p[0], 0) / q.length,
  q.reduce((s, p) => s + p[1], 0) / q.length,
];

/** The quad pulled in by d (each edge offset inwards, corners re-intersected). */
function inset(q, d) {
  const n = q.length;
  const lines = q.map((a, i) => {
    const b = q[(i + 1) % n];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const L = Math.hypot(dx, dy) || 1;
    // screen quads run near-left, near-right, far-right, far-left: inwards is (dy, −dx)
    const nx = dy / L;
    const ny = -dx / L;
    return [
      [a[0] + nx * d, a[1] + ny * d],
      [dx, dy],
    ];
  });
  return lines.map((l, i) => {
    const m = lines[(i + n - 1) % n];
    const [p, r] = m;
    const [s, u] = l;
    const den = r[0] * u[1] - r[1] * u[0] || 1e-9;
    const t = ((s[0] - p[0]) * u[1] - (s[1] - p[1]) * u[0]) / den;
    return [p[0] + r[0] * t, p[1] + r[1] * t];
  });
}

/** A tiny salt worker, raking along the bund: ~h units tall, facing `dir` (1 right, −1 left). */
function worker(P, x, y, h, dir, t) {
  const s = h / 10;
  const f = (pts) => pts.map(([u, v]) => [x + dir * u * s, y - v * s]);
  const o = { w: 0.75, t, amp: 0.04, taper: 'ends' };
  P.shape(
    f([
      [0.15, 9.7],
      [0.75, 9.45],
      [0.8, 8.85],
      [0.25, 8.6],
      [-0.3, 9.05],
    ]),
    { ...o, w: 0.75 },
  ); // head, a wrapped cloth
  P.curve(
    f([
      [0.35, 8.55],
      [0.6, 7.2],
      [0.2, 5.3],
    ]),
    o,
  ); // back, bent over the rake
  P.curve(
    f([
      [0.6, 8.3],
      [1.7, 7.1],
      [2.55, 6.6],
    ]),
    o,
  ); // arms to the handle
  P.curve(
    f([
      [0.45, 8.2],
      [1.4, 6.6],
      [2.1, 6.3],
    ]),
    { ...o, w: 0.5 },
  );
  P.curve(
    f([
      [0.2, 5.3],
      [-0.5, 2.6],
      [-0.9, 0],
    ]),
    o,
  ); // legs
  P.curve(
    f([
      [0.2, 5.3],
      [0.7, 2.7],
      [0.9, 0],
    ]),
    o,
  );
  P.curve(
    f([
      [0.4, 7.6],
      [1.6, 5.4],
      [1.8, 4.4],
    ]),
    { ...o, w: 0.5 },
  ); // the dhoti's fold
  P.line(
    f([
      [1.2, 7.9],
      [6.2, 0.4],
    ]),
    { ...o, w: 0.5 },
  ); // the rake
  P.line(
    f([
      [5.4, 0.15],
      [6.9, 0.65],
    ]),
    { ...o, w: 0.75 },
  );
  P.line(
    f([
      [-1.4, -0.15],
      [1.4, -0.1],
    ]),
    { ...o, w: 0.5, t: t + 1 },
  ); // its shadow on the bund
}

function build(name, v) {
  const { W, H, HZ, F } = v;
  const E = (H - HZ) / (1 / ZN - 1 / ZF);
  const proj = ([X, z]) => [W / 2 + (X * F) / z, HZ + E * (1 / z - 1 / ZF)];
  const { rows, pans } = plan();
  const P = Plate(name === 'wide' ? 3101 : 3102, { vignette: false, width: W, height: H });
  const rnd = RNG(name === 'wide' ? 77 : 78);

  // rings: from the centre of the view outward
  const C = [W / 2, HZ + 0.42 * (H - HZ)];
  const dmax = Math.hypot(W / 2, H - C[1]);
  const ring = ([x, y]) => Math.min(4, Math.floor((5 * Math.hypot(x - C[0], y - C[1])) / dmax));
  const at = (stage, p, tag = '') => P.at(`${stage}.${ring(p)}${tag}`);

  // ---- which pans show ----
  const seen = pans
    .map((p) => ({ ...p, s: p.q.map(proj) }))
    .filter(({ s }) => {
      const xs = s.map((q) => q[0]);
      const ys = s.map((q) => q[1]);
      return Math.max(...xs) > 4 && Math.min(...xs) < W - 4 && Math.min(...ys) < H - 4;
    });

  // ---- foreground first: mounds and figures hide what lies behind them ----
  const mounds = [];
  const [mr, mh] = v.mound;
  // the far mound, centred on the far edge: where the 3D mound is at the hand-over
  mounds.push([W / 2, HZ, mr, mh]);
  const bundZ = rows.slice(1).map(([, z1]) => z1 + BUNDZ / 2);
  const nearBund = (z) => bundZ.reduce((m, b) => (Math.abs(b - z) < Math.abs(m - z) ? b : m));
  for (const [X, z] of [
    [0.82, 1.31],
    [-1.25, 1.62],
    [0.3, 1.72],
    [1.55, 1.18],
    [-0.05, 1.12],
  ]) {
    const zb = nearBund(z);
    const [x, y] = proj([X, zb]);
    if (x < 40 || x > W - 40 || y > H - 30) continue;
    if (mounds.length >= v.mounds) break;
    const r = (0.07 * F) / zb;
    mounds.push([x, y, r, r * 0.6]);
  }
  for (const [x, y, r, h] of mounds) {
    at(4, [x, y]);
    mound(P, x, y, r, h, { t: 4, ht: 6, fine: r > 40 ? 2.2 : 1.8 });
    // its paper: hides the horizon (and whatever else is behind it) once it is drawn
    const poly = curve([
      [x - r, y + 0.5],
      [x - r * 0.36, y - h * 0.64],
      [x + r * 0.04, y - h],
      [x + r * 0.56, y - h * 0.38],
      [x + r, y + 0.5],
    ]);
    P.paper([...poly, poly[0]]);
  }

  const figures = [];
  for (const [X, z, dir] of [
    [-0.95, 1.86, 1],
    [1.15, 1.9, -1],
    [0.55, 1.52, 1],
  ]) {
    if (figures.length >= v.figures) break;
    const zb = nearBund(z);
    const [x, y] = proj([X, zb]);
    if (x < 30 || x > W - 30) continue;
    const h = (0.105 * F) / zb;
    at(5, [x, y], `.f${figures.length}`);
    worker(P, x, y, h, dir, 5);
    figures.push([x, y, h]);
  }

  // ---- 1: the feeder canal, banks doubled, water dashes ----
  const zs = [];
  for (let z = ZF; z >= 0.62; z -= 0.01) zs.push(z);
  const bank = (dx) => zs.map((z) => proj([canalX(z) + dx, z]));
  P.at('1.0');
  for (const dx of [-CANAL / 2, CANAL / 2])
    P.line(bank(dx), { w: 1, t: 1, amp: 0.25, taper: false });
  for (const dx of [-CANAL / 2 - BUND, CANAL / 2 + BUND])
    P.line(bank(dx), { w: 0.75, t: 1, amp: 0.25, taper: false });
  const breezes = [];
  for (let z = ZF - 0.03; z > 0.64; z -= 0.022 + 0.018 * (2 - z)) {
    const [xl, y] = proj([canalX(z) - CANAL / 2, z]);
    const [xr] = proj([canalX(z) + CANAL / 2, z]);
    if (y > H) break;
    P.ripple(xl + 3, xr - 3, y, { w: 0.5, t: 1, seg: (xr - xl) * 0.35 });
  }
  for (const z of [1.62, 1.24]) {
    const [xl, y] = proj([canalX(z) - CANAL / 2, z]);
    const [xr] = proj([canalX(z) + CANAL / 2, z]);
    if (y < H - 10) breezes.push([xl, y - 2, (xr - xl) * 0.32, (xr - xl) * 0.6]);
  }

  // ---- 2 bunds, 3 pans, 6 hatching (per pan, from the centre outward) ----
  for (const p of seen) {
    const s = p.s;
    const zc = (p.q[0][1] + p.q[2][1]) / 2;
    const near = zc < 1.35;
    const c = centroid(s);
    at(2, c);
    // the pan's edges are the bunds' sides: next to its neighbour's, they read as double lines
    P.line([s[0], s[1]], { w: near ? 1.25 : 1, t: 2, amp: 0.3 }); // near edge: the shadow side
    P.line([s[1], s[2]], { w: near ? 1 : 0.75, t: 2, amp: 0.3 });
    P.line([s[2], s[3]], { w: near ? 0.75 : 0.5, t: 2, amp: 0.3 });
    P.line([s[3], s[0]], { w: near ? 1 : 0.75, t: 2, amp: 0.3 });
    // 3: the bund's shadow on the water, just inside the far edge
    at(3, c);
    const sh = 2.2 + 140 / ((zc * F) / 2);
    const along = (f) => [lerp(s[3][0], s[2][0], f), lerp(s[3][1], s[2][1], f) + sh];
    P.line([along(0.06), along(0.9)], { w: 0.5, t: 3, amp: 0.2 });
    // 6: hatching: level water strokes on most pans, a ruled tint on some, the bund's flank
    at(6, c);
    const gap = clamp(9 / zc, 3.4, 8.5);
    if (p.i % 4 === 0) {
      P.hatch(s.concat([s[0]]), {
        angle: 0,
        gap,
        t: 6,
        shared: true,
        jitter: 0.25,
        max: 90,
        shade: () => 0.7,
      });
    } else {
      const xs = s.map((q) => q[0]);
      const ys = s.map((q) => q[1]);
      const n = Math.round(clamp(5 / zc, 2, 6));
      for (let k = 0; k < n; k++) {
        const x = lerp(Math.min(...xs), Math.max(...xs), rnd());
        const y = lerp(Math.min(...ys) + sh * 2, Math.max(...ys) - 3, rnd());
        const l = 8 + 30 / zc;
        if (inside(s, [x, y]) && inside(s, [x + l, y]))
          P.rule([x, y], [x + l, y + (rnd() - 0.5) * 0.6], { w: 0.5, t: 6 });
      }
    }
    // the near bund's flank (between this pan and the row in front), lightly hatched
    const f0 = proj([p.q[0][0], p.q[0][1] - BUNDZ * 0.5]);
    const f1 = proj([p.q[1][0], p.q[1][1] - BUNDZ * 0.5]);
    P.hatch([s[0], s[1], f1, f0, s[0]], {
      angle: 78,
      gap: clamp(5.2 / zc, 2.2, 4.5),
      t: 6,
      shared: true,
      shade: (x) => 0.45 + 0.3 * Math.sin(x * 0.05),
    });
  }

  // ---- the colour layer (under the lines: a hand-coloured engraving) ----
  const pfx = name[0];
  const defs = [];
  const colour = [];
  const glintSpots = [];
  // the order the pans fill in: out from the canal, a little uneven
  const order = [...seen].sort((a, b) => a.dist + a.jit * 0.35 - (b.dist + b.jit * 0.35));
  const rank = new Map(order.map((p, i) => [p, i / Math.max(1, order.length - 1)]));
  // the settle: a pink pan near the middle of the view, wholly in it
  const goal = [W / 2, HZ + 0.6 * (H - HZ)];
  const whole = (p) => p.s.every(([x, y]) => x > 8 && x < W - 8 && y < H - 8);
  const settle = seen
    .filter((p) => p.kind !== 'f' && whole(p))
    .sort(
      (a, b) => Math.hypot(...sub(centroid(a.s), goal)) - Math.hypot(...sub(centroid(b.s), goal)),
    )[0];
  let settleBox = null;
  for (const p of seen) {
    const s = p.s;
    const id = `${pfx}c${p.i}`;
    defs.push(`<clipPath id="${id}"><path d="${polyD(s)}"/></clipPath>`);
    // the water comes in from the canal side
    const dir = p.side === 'l' ? -1 : 1;
    // (the band starts behind the inlet edge's outermost point: nothing shows before it moves)
    const inlet =
      dir > 0
        ? [Math.min(s[0][0], s[3][0]), (s[0][1] + s[3][1]) / 2]
        : [Math.max(s[1][0], s[2][0]), (s[1][1] + s[2][1]) / 2];
    const D = Math.max(...s.map(([x]) => (x - inlet[0]) * dir)) + 2;
    const R = Math.max(...s.map(([, y]) => Math.abs(y - inlet[1]))) + 2;
    const band = (cls, soft) => {
      const len = D + soft;
      return `<rect class="${cls}" fill="url(#${pfx}g${cls})" x="${r1(-len)}" y="${r1(-R)}" width="${r1(len)}" height="${r1(2 * R)}" transform="translate(${r1(len)})" data-d="${r1(len)}"/>`;
    };
    const kind = p.kind;
    const bands = band('w', SOFT.w) + (kind === 'f' ? '' : band(kind === 'd' ? 'kd' : 'k', SOFT.k));
    let crust = '';
    let shimmer = '';
    if (kind !== 'f') {
      const zc = (p.q[0][1] + p.q[2][1]) / 2;
      const d0 = clamp(4 / zc, 1.8, 4.5);
      const inner = inset(s, d0 * 0.55);
      const pts = [];
      for (let e = 0; e < 4; e++) {
        const A = inner[e];
        const B = inner[(e + 1) % 4];
        const L = Math.hypot(B[0] - A[0], B[1] - A[1]);
        const n = Math.max(3, Math.round(L / 3.2));
        const nx = (B[1] - A[1]) / L;
        const ny = -(B[0] - A[0]) / L;
        for (let k = 0; k < n; k++) {
          const t = k / n;
          let dd = d0 * (0.15 + 0.7 * rnd() ** 2);
          if (rnd() < 0.1) dd += d0 * 0.9; // a crystal reaching further in
          pts.push([lerp(A[0], B[0], t) + nx * dd, lerp(A[1], B[1], t) + ny * dd]);
        }
      }
      const outer = inset(s, -2);
      const c = centroid(s);
      const rmin = Math.min(
        ...s.map((a, i) => {
          const b = s[(i + 1) % 4];
          const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
          return Math.abs((b[0] - a[0]) * (a[1] - c[1]) - (a[0] - c[0]) * (b[1] - a[1])) / L;
        }),
      );
      const s0 = 1 + (d0 * 2.6) / Math.max(4, rmin);
      crust = `<path class="cr" fill="#fbf8f1" fill-rule="evenodd" d="${polyD(outer)}${polyD(pts, r2)}" data-s0="${s0.toFixed(3)}" data-c="${r1(c[0])} ${r1(c[1])}"/>`;
      // the shimmer: level highlight lines, lit one after another across the pan
      const lines = [];
      [0.28, 0.5, 0.72].forEach((f, i) => {
        const l = [lerp(s[3][0], s[0][0], f), lerp(s[3][1], s[0][1], f)];
        const r = [lerp(s[2][0], s[1][0], f), lerp(s[2][1], s[1][1], f)];
        const a = lerp(l[0], r[0], 0.18 + rnd() * 0.1);
        const b = lerp(l[0], r[0], 0.72 + rnd() * 0.12);
        lines.push(`<path d="M${r1(a)} ${r1(lerp(l[1], r[1], 0.3))}H${r1(b)}" style="--i:${i}"/>`);
      });
      shimmer = `<g class="sh">${lines.join('')}</g>`;
      if (pts.length) {
        for (let g = 0; g < 2; g++)
          glintSpots.push({ pt: pts[Math.floor(rnd() * pts.length)], zc });
      }
    }
    if (p === settle) {
      const xs = s.map((q) => q[0]);
      const ys = s.map((q) => q[1]);
      settleBox = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
    }
    // low tier: the outer pans stay uncoloured (data-x)
    const outer = ring(centroid(s)) >= 3 && p !== settle;
    colour.push(
      `<g class="pn" clip-path="url(#${id})" data-o="${rank.get(p).toFixed(3)}" data-k="${kind}"${outer ? ' data-x=""' : ''}><g transform="translate(${r1(inlet[0])} ${r1(inlet[1])})${dir < 0 ? ' rotate(180)' : ''}">${bands}</g>${crust}${shimmer}</g>`,
    );
  }
  for (const [cls, col] of Object.entries(COLOURS)) {
    const soft = cls === 'w' ? SOFT.w : SOFT.k;
    defs.push(
      `<linearGradient id="${pfx}g${cls}" gradientUnits="userSpaceOnUse" x1="${-soft}" x2="0" y1="0" y2="0"><stop offset="0" stop-color="${col}"/><stop offset="1" stop-color="${col}" stop-opacity="0"/></linearGradient>`,
    );
  }

  // ---- glints: on the mounds' lit sides and along the crusts, a few at a time ----
  const glints = [];
  for (const [x, y, r, h] of mounds) {
    for (let k = 0; k < 2; k++)
      glints.push([
        x + r * (0.05 + rnd() * 0.45),
        y - h * (0.15 + rnd() * 0.5),
        clamp(r / 9, 2.4, 5),
      ]);
  }
  glintSpots.sort((a, b) => a.zc - b.zc); // nearer crusts first: they are larger
  for (const { pt, zc } of glintSpots) {
    if (glints.length >= v.glints) break;
    if (glints.some((g) => Math.hypot(g[0] - pt[0], g[1] - pt[1]) < 60)) continue;
    glints.push([pt[0], pt[1], clamp(4.4 / zc, 2.4, 4.4)]);
  }
  const glintSvg = glints
    .map(([x, y, r], i) => {
      const g = r;
      return `<g class="gl" data-o="${((i * 0.618) % 1).toFixed(3)}"><path class="f" fill="#a8823f" stroke="none" d="${star(x, y, g, 0.2)}"/><path class="hr" d="M${r1(x - g * 2)} ${r1(y)}h${r1(g * 4)}M${r1(x)} ${r1(y - g * 2.8)}v${r1(g * 5.6)}"/></g>`;
    })
    .join('');

  // ---- the plate's strokes, in their draw groups ----
  const plate = P.svg('');
  // every stroke carries its longest subpath (data-m): the page never measures a path
  const body = plate
    .slice(plate.indexOf('>') + 1, plate.lastIndexOf('</svg>'))
    .replace(
      /<path(?![^>]*data-m)(?![^>]*class="p")([^>]*) d="([^"]+)"/g,
      (_, a, d) => `<path${a} d="${d}" data-m="${longest(d)}"`,
    );
  const breezeSvg = breezes
    .map(
      ([x, y, l, w], i) =>
        `<path class="bz" d="M${r1(x)} ${r1(y)}h${r1(l)}" style="--w:${r1(w)}px;--d:${i * 3.1}s"/>`,
    )
    .join('');
  const style =
    '<style>.p{fill:#f5f1e8;stroke:none}[data-lines] path,.hz{vector-effect:non-scaling-stroke;stroke-width:.75px}[data-lines] .a{stroke-width:.5px}[data-lines] .b,.hz{stroke-width:1px}[data-lines] .c{stroke-width:1.25px}[data-lines] .d{stroke-width:1.4px}.hr{stroke-width:.3px;vector-effect:non-scaling-stroke}.sh,.bz{display:none}</style>';
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" fill="none" stroke="#a8823f" stroke-linecap="round" stroke-linejoin="round" data-hz="${HZ}" data-settle="${settleBox.map(r1).join(' ')}">` +
    style +
    `<defs>${defs.join('')}</defs>` +
    `<g data-cam=""><g data-colour="" stroke="none">${colour.join('')}</g>` +
    `<path class="hz" d="M0 ${HZ}H${W}"/>` +
    `<g data-lines="">${body}</g>${breezeSvg}<g data-glints="">${glintSvg}</g></g></svg>`;
  return { svg, pans: seen.length, coloured: seen.filter((p) => p.kind !== 'f').length };
}

/** The longest subpath of a path in pathD's form (M x y l dx dy …), rounded up. */
function longest(d) {
  let best = 0;
  for (const sp of d.split('M').slice(1)) {
    const nums = (sp.split('l')[1] ?? '').match(/-?\d*\.?\d+/g) ?? [];
    let L = 0;
    for (let i = 0; i + 1 < nums.length; i += 2) L += Math.hypot(+nums[i], +nums[i + 1]);
    best = Math.max(best, L);
  }
  return Math.ceil(best) + 1;
}

const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];

export function buildPans() {
  for (const [name, v] of Object.entries(VARIANTS)) {
    const { svg, pans, coloured } = build(name, v);
    const f = join(OUT, `pans-${name}.svg`);
    writeFileSync(f, svg);
    console.log(
      `pans-${name}.svg`,
      (statSync(f).size / 1024).toFixed(1) + ' KB',
      `${pans} pans (${coloured} pink)`,
    );
  }
}
