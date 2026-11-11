// "A day at Sambhar": the Journey panorama, one etched landscape in three parallax layers.
//   npm run engravings
// Writes public/engravings/journey-{sky,far,near}.svg and the layout constants the page reads
// (components/sections/Journey/panorama.ts). Everything is seeded, so the output is repeatable.
//
// Layers: sky · far (far pans, horizon, mounds, the jar) · near (near pans, water, figures).
// Whatever crosses the horizon lives in the far layer with it, so the horizon stops exactly at
// its outline even while the layers slide. Near objects stay below the seam between the layers.
import { mkdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Plate, curve, rect, clamp, lerp, inside, H } from './engrave.mjs';
import { CAM, projectJar } from './jar3d.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const OUT = join(here, '../../public/engravings');
const CONSTS = join(here, '../../components/sections/Journey/panorama.ts');

const S = 820; // one scene, in plate units (a 1440 × 900 viewport shows about one)
const M = 460; // margin beyond the first and last scene, for wide screens
const HZ = 190; // the horizon
const F = 520; // focal length
const EYE = 8; // the 8 m viewpoint
const E = EYE * F;
const SEAM_Z = 51.6; // depth where the near layer hands over to the far layer
const ZREF = 15;
const SPEEDS = { near: 1, far: 0.93, sky: 0.86 };
/** The jar stands right of its scene's centre, clear of the caption (phones re-centre on it). */
const JAR_DX = 150;

const layout = (v) => {
  const centers = [0, 1, 2, 3, 4].map((i) => M + S * v * (i + 0.5));
  return { speed: v, width: Math.round(2 * M + 5 * S * v), centers };
};
const L = { near: layout(SPEEDS.near), far: layout(SPEEDS.far), sky: layout(SPEEDS.sky) };

/** Each scene's vanishing point (offset from its centre) and how its block of pans is turned. */
const VP_OFF = [10, 30, -20, 20, 0];
const YAW = [-0.2, 0.16, 0.23, -0.25, 0.1];
const smooth = (a, b, x) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

/**
 * Each scene is its own block of pans with its own vanishing point, in true perspective. Two
 * fans can't be blended without columns crossing the wrong way, so, as in real salt works, a
 * main feeder canal separates the blocks; the bunds and mounds carry on across it.
 */
function fan(layer, i, d, z) {
  const dd = (d * ZREF) / z;
  return [
    L[layer].centers[i] + VP_OFF[i] + dd,
    HZ + E / (z * Math.max(0.35, 1 + (YAW[i] * dd) / F)),
  ];
}
/** The point on row z at plate position x, in scene i's block. */
const onRow = (layer, i, x, z) => {
  const V = L[layer].centers[i] + VP_OFF[i];
  return fan(layer, i, ((x - V) * z) / ZREF, z);
};
/** The canal's centre between scenes i and i + 1. */
const canalX = (layer, i) => (L[layer].centers[i] + L[layer].centers[i + 1]) / 2;
/** Scene i's block runs from one canal to the next. */
const inBlock =
  (layer, i) =>
  ([x]) =>
    (i === 0 || x > canalX(layer, i - 1)) && (i === 4 || x < canalX(layer, i));
/** Which scene a layer position belongs to. */
const sceneAt = (layer, x) => {
  for (let i = 0; i < 4; i++) if (x < canalX(layer, i)) return i;
  return 4;
};

/** Pan columns of one block: offsets from its vanishing point at the reference depth. */
const COLS = (() => {
  const out = [];
  let x = -372 * 9;
  let i = 0;
  while (x < 372 * 9) {
    const channel = i % 3 === 2;
    out.push({ x0: x, x1: x + 372, channel, i });
    x += 372 + (channel ? 52 : 21);
    i++;
  }
  return out;
})();
const NEAR_ROWS = [
  [12, 24.6],
  [25.2, 37.8],
  [38.4, 51],
];

function mound(P, cx, base, r, h, { t = 4, fine = 2.2 } = {}) {
  const k = P.rnd() * 1.4;
  const top = curve([
    [cx - r, base],
    [cx - r * 0.74, base - h * 0.2 - k],
    [cx - r * 0.36, base - h * 0.64],
    [cx - r * 0.08, base - h * 0.97],
    [cx + r * 0.04, base - h],
    [cx + r * 0.2, base - h * 0.8],
    [cx + r * 0.56, base - h * 0.38 + k],
    [cx + r * 0.86, base - h * 0.09],
    [cx + r, base],
  ]);
  const poly = [...top, top[0]];
  P.line(top, { w: r > 24 ? 1.25 : 0.75, t, swell: r > 24, taper: 'ends' });
  const gap = r > 40 ? fine : fine * 1.25;
  const lit = (x) => (x - cx) / r;
  P.hatch(poly, {
    angle: 63,
    gap,
    t: t + 1,
    shared: true,
    shade: (x) => 0.2 + lit(x) * 0.95,
    over: r > 40 ? (x) => lit(x) > 0.5 : undefined,
  });
  P.hatch(poly, {
    angle: 118,
    gap: gap * 1.05,
    t: t + 1,
    shared: true,
    shade: (x) => lit(x) * 1.15 - 0.12,
  });
  P.block(poly);
}

/** Draws into both plates; the overlay also gets a paper backing for each block. */
const twin = (P, R) => ({
  shape: (p, o) => (P.shape(p, o), R.shape(p, o)),
  hatch: (p, o) => (P.hatch(p, o), R.hatch(p, o)),
  block: (p) => (P.block(p), R.block(p), R.paper(p)),
});

const figure = (x0, y0, s) => (pts) => pts.map(([u, v]) => [x0 + u * s, y0 - v * s]);

/** 03: profile, facing left, weight back, drawing a long rake towards him. 26% of the plate. */
function raker(P, x0, y0, R) {
  // the worker, rake and reflection move as one (an overlay); the plate draws them only to keep
  // its random stream as approved, into a group that is then left out
  const D = twin(P, R);
  const free = P.blocks();
  const scene = 2;
  P.at('drop');
  const s = 19;
  const F2 = figure(x0, y0, s);
  const Sh = (pts, o) => D.shape(F2(pts), { w: 1, t: 2, amp: 0.08, ...o });
  const wrap = Sh(
    [
      [0, 6.76],
      [0.06, 7.02],
      [0.4, 7.2],
      [0.78, 7.12],
      [0.98, 6.86],
      [0.92, 6.68],
      [0.5, 6.7],
    ],
    { w: 1 },
  );
  D.hatch(wrap, {
    angle: 24,
    gap: 1.5,
    t: 3,
    shade: (x) => (x - (x0 + 0.2 * s)) / (0.8 * s) + 0.4,
  });
  D.block(wrap);
  const head = Sh(
    [
      [0.05, 6.72],
      [0.04, 6.42],
      [0.1, 6.16],
      [0.32, 6],
      [0.62, 6.02],
      [0.86, 6.26],
      [0.9, 6.68],
    ],
    { w: 1 },
  );
  D.hatch(head, { angle: 70, gap: 1.5, t: 3, shade: (x) => (x - (x0 + 0.5 * s)) / (0.4 * s) });
  D.block(head);
  const arm = Sh(
    [
      [0.5, 5.72],
      [0.06, 5.12],
      [-0.44, 4.74],
      [-1, 4.52],
      [-1.24, 4.44],
      [-1.24, 4.18],
      [-0.96, 4.22],
      [-0.36, 4.4],
      [0.26, 4.86],
      [0.86, 5.42],
    ],
    { w: 1 },
  );
  D.hatch(arm, { angle: 52, gap: 1.5, t: 3, shade: () => 0.5 });
  D.block(arm);
  const shirt = Sh(
    [
      [0.22, 5.98],
      [-0.05, 5.58],
      [-0.14, 4.72],
      [-0.18, 3.72],
      [-0.3, 3.04],
      [0.4, 2.94],
      [1.06, 3.04],
      [0.92, 3.92],
      [0.98, 4.82],
      [0.9, 5.62],
      [0.62, 5.98],
    ],
    { w: 1.25 },
  );
  D.hatch(shirt, {
    angle: 70,
    gap: 1.6,
    t: 3,
    shade: (x) => (x - (x0 + 0.3 * s)) / (0.7 * s) + 0.15,
    over: (x) => x > x0 + 0.7 * s,
  });
  D.hatch(shirt, { angle: 124, gap: 1.8, t: 3, shade: (x) => (x - (x0 + 0.6 * s)) / (0.4 * s) });
  D.block(shirt);
  const far = Sh(
    [
      [0.3, 5.4],
      [-0.5, 4.56],
      [-1.7, 4.14],
      [-1.92, 4.06],
      [-1.92, 3.84],
      [-1.66, 3.86],
      [-0.46, 4.26],
      [0.42, 4.9],
    ],
    { w: 0.75 },
  );
  D.hatch(far, { angle: 40, gap: 1.4, t: 3, shade: () => 0.9 });
  D.block(far);
  const frontLeg = Sh(
    [
      [-0.22, 3.04],
      [-0.6, 2],
      [-0.96, 1.02],
      [-0.56, 0.86],
      [-0.12, 2],
      [0.38, 3.0],
    ],
    { w: 1 },
  );
  D.hatch(frontLeg, { angle: 66, gap: 1.6, t: 3, shade: () => 0.6 });
  D.block(frontLeg);
  const rearLeg = Sh(
    [
      [0.42, 3.0],
      [0.62, 2],
      [0.82, 0.92],
      [1.26, 1.0],
      [1.42, 2],
      [1.02, 3.04],
    ],
    { w: 1 },
  );
  D.hatch(rearLeg, {
    angle: 72,
    gap: 1.6,
    t: 3,
    shade: (x) => (x - (x0 + 0.7 * s)) / (0.6 * s) + 0.3,
  });
  D.block(rearLeg);
  D.block(
    Sh(
      [
        [-0.92, 1.02],
        [-1.08, 0.3],
        [-1.46, 0.04],
        [-1.5, -0.05],
        [-0.84, -0.05],
        [-0.74, 0.3],
        [-0.62, 0.94],
      ],
      { w: 0.75 },
    ),
  );
  D.block(
    Sh(
      [
        [0.86, 0.96],
        [0.86, 0.3],
        [0.56, 0.04],
        [0.52, -0.05],
        [1.2, -0.05],
        [1.22, 0.3],
        [1.24, 0.98],
      ],
      { w: 0.75 },
    ),
  );
  // the rake lives in its own overlay (it moves); the figure stays in the plate
  const [pA] = F2([[-0.42, 4.72]]);
  const [pB] = F2([[-9.6, 0.12]]);
  for (const Q of [P, R]) {
    Q.line([pA, pB], { w: 1, t: 1, amp: 0.25 });
    Q.line(
      [
        [pA[0] + 1, pA[1] + 2],
        [pB[0] + 1, pB[1] + 2],
      ],
      { w: 0.5, t: 1, amp: 0.25 },
    );
  }
  const board = F2([
    [-10.7, 0.5],
    [-8.7, 0.16],
    [-8.7, -0.34],
    [-10.7, 0.02],
    [-10.7, 0.5],
  ]);
  for (const Q of [P, R]) {
    Q.line(board, { w: 1.25, t: 2, taper: 'swell', swell: true, amp: 0.1 });
    Q.hatch(board, { angle: 170, gap: 1.5, t: 3 });
  }
  R.paper(board);
  const flip = F2([
    [-1.5, 0],
    [1.5, 0],
    [1.1, -3.4],
    [0.5, -6.2],
    [-0.2, -6.2],
    [-0.5, -3.4],
    [-1.5, 0],
  ]).map(([x, y]) => [x, y0 + (y - y0) * 0.8]);
  P.hatch(flip, {
    angle: 0,
    gap: 2.7,
    t: 6,
    opacity: 0.7,
    max: 13,
    shade: (x, y) => 1 - (y - y0) / 110,
  });
  P.at(scene);
  P.release(free); // the plate behind the figure stays drawn: the overlay covers it
  for (let i = 0; i < 5; i++)
    P.ripple(x0 - 220 + i * 8, x0 - 32 - i * 3, y0 + 5 + i * 6, { seg: 24, t: 5, w: 0.5 });
  return { board, flip, y0, top: y0 - 7.3 * s, right: x0 + 1.6 * s };
}

/** 04: walking left, the basket ON her head, one arm steadying it, reflected in the brine. */
function carrier(P, fx, fy) {
  const s = 16.5;
  const F2 = figure(fx, fy, s);
  const sil = [];
  const Sh = (pts, o) => {
    const p = P.shape(F2(pts), { w: 1, t: 2, amp: 0.08, ...o });
    sil.push(p);
    return p;
  };
  const heap = Sh(
    [
      [-1, 7.92],
      [-0.76, 8.34],
      [-0.3, 8.7],
      [0.3, 8.86],
      [0.9, 8.72],
      [1.4, 8.34],
      [1.6, 7.92],
    ],
    { w: 1.25 },
  );
  P.hatch(heap, {
    angle: 60,
    gap: 1.6,
    t: 3,
    shade: (x) => (x - (fx - 0.2 * s)) / (1.7 * s) + 0.1,
    over: (x) => x > fx + 0.9 * s,
  });
  P.hatch(heap, { angle: 120, gap: 1.7, t: 3, shade: (x) => (x - (fx + 0.6 * s)) / s });
  P.block(heap);
  const basket = Sh(
    [
      [-1.26, 7.86],
      [-0.9, 7.4],
      [-0.3, 7.16],
      [0.3, 7.1],
      [0.9, 7.16],
      [1.5, 7.4],
      [1.86, 7.86],
      [1.2, 7.94],
      [0.3, 7.96],
      [-0.6, 7.94],
    ],
    { w: 1.25 },
  );
  for (let i = -6; i <= 6; i++) {
    const [a, b] = F2([
      [0.3 + i * 0.25, 7.92],
      [0.3 + i * 0.19, 7.14 + Math.abs(i) * 0.02],
    ]);
    P.line([a, b], { w: 0.5, t: 3, taper: false, amp: 0.02 });
  }
  P.hatch(basket, { angle: 0, gap: 2.1, t: 3, shade: (x) => (x - fx) / (1.6 * s) + 0.5 });
  P.block(basket);
  P.block(
    Sh(
      [
        [-0.2, 7],
        [0.3, 7.14],
        [0.82, 7],
        [0.82, 6.92],
        [0.3, 6.84],
        [-0.2, 6.92],
      ],
      { w: 0.75 },
    ),
  );
  const arm = Sh(
    [
      [0.62, 5.72],
      [0.1, 5.98],
      [-0.42, 6.34],
      [-0.78, 6.86],
      [-0.92, 7.3],
      [-1.18, 7.3],
      [-1.04, 6.74],
      [-0.66, 6.04],
      [-0.14, 5.56],
      [0.46, 5.3],
    ],
    { w: 1 },
  );
  P.hatch(arm, { angle: 60, gap: 1.5, t: 3, shade: () => 0.5 });
  P.block(arm);
  P.block(
    Sh(
      [
        [0.02, 6.86],
        [0, 6.5],
        [0.08, 6.2],
        [0.3, 6],
        [0.6, 6.02],
        [0.82, 6.24],
        [0.86, 6.62],
        [0.72, 6.88],
      ],
      { w: 1 },
    ),
  );
  const dup = Sh(
    [
      [0.4, 6.9],
      [0.86, 6.82],
      [1, 6.3],
      [1.06, 5.6],
      [1.22, 4.2],
      [1.56, 2.8],
      [1.94, 2.04],
      [1.7, 1.84],
      [1.2, 2.1],
      [0.84, 3.2],
      [0.7, 4.8],
      [0.62, 5.8],
      [0.5, 6.4],
    ],
    { w: 1.25 },
  );
  P.hatch(dup, { angle: 72, gap: 1.4, t: 3, shade: (x) => (x - (fx + 0.7 * s)) / (0.5 * s) + 0.5 });
  P.hatch(dup, { angle: 128, gap: 1.6, t: 3, shade: (x) => (x - (fx + 0.95 * s)) / (0.45 * s) });
  P.block(dup);
  const armF = Sh(
    [
      [0.32, 5.42],
      [-0.06, 4.6],
      [-0.3, 3.8],
      [-0.3, 3.52],
      [-0.08, 3.5],
      [0.1, 3.84],
      [0.38, 4.54],
      [0.62, 5.1],
    ],
    { w: 0.75 },
  );
  P.hatch(armF, { angle: 68, gap: 1.4, t: 3, shade: () => 0.8 });
  P.block(armF);
  const bodice = Sh(
    [
      [0.18, 6.02],
      [0.08, 5.62],
      [0.12, 4.38],
      [0.88, 4.34],
      [0.78, 5.72],
      [0.56, 6.02],
    ],
    { w: 1 },
  );
  P.hatch(bodice, { angle: 64, gap: 1.5, t: 3, shade: (x) => (x - (fx + 0.45 * s)) / (0.45 * s) });
  P.block(bodice);
  const skirt = Sh(
    [
      [0.1, 4.4],
      [-0.26, 3.2],
      [-0.8, 1.4],
      [-1.06, 0.26],
      [-0.6, 0],
      [0.4, -0.06],
      [1.36, 0],
      [1.6, 0.36],
      [1.36, 1.4],
      [1.06, 3],
      [0.88, 4.4],
    ],
    { w: 1.25 },
  );
  P.hatch(skirt, {
    angle: 80,
    gap: 1.6,
    t: 3,
    shade: (x) => (x - (fx + 0.5 * s)) / (0.9 * s) + 0.12,
    over: (x) => x > fx + 1.1 * s,
  });
  P.hatch(skirt, { angle: 112, gap: 1.9, t: 3, shade: (x) => (x - (fx + 0.95 * s)) / (0.6 * s) });
  for (const c of [
    [
      [0.2, 4.2],
      [-0.2, 2.2],
      [-0.72, 0.3],
    ],
    [
      [0.42, 4.2],
      [0.3, 2.2],
      [0.16, 0.04],
    ],
    [
      [0.64, 4.2],
      [0.8, 2.2],
      [0.96, 0.04],
    ],
  ])
    P.curve(F2(c), { w: 0.5, t: 3, amp: 0.05 });
  P.block(skirt);
  P.block(
    Sh(
      [
        [-1.04, 0.2],
        [-1.46, 0],
        [-1.52, -0.08],
        [-0.82, -0.1],
        [-0.68, 0.14],
      ],
      { w: 0.75 },
    ),
  );
  const reflect = sil.map((p) => p.map(([x, y]) => [x, fy + (fy - y) * 0.42]));
  for (const p of reflect)
    P.hatch(p, {
      angle: 0,
      gap: 2.4,
      t: 6,
      opacity: 0.62,
      jitter: 0.5,
      max: 16,
      shade: (x, y) => 1.05 - (y - fy) / 90,
    });
  for (const p of reflect) P.block(p);
  for (const [x, y, l] of [
    [-50, 4, 30],
    [36, 6, 36],
    [-56, 12, 28],
    [50, 14, 44],
  ])
    P.ripple(fx + x, fx + x + l, fy + y, { seg: 12, t: 5, w: 0.75 });
}

/** 05: the Pyoor jar (12.2 : 10, from the 3D model) on a small heap of black salt. */
/**
 * 05: the Pyoor jar on its mound, 65% of the plate's height (the viewport's, on desktop), in
 * the GLB's exact proportions: 12.2 cm tall with the cap, 10 cm across. The label is one clean
 * rectangle with a hairline border.
 */
function jar(P, cx) {
  const Hj = 333;
  const J = Hj / 1.22;
  const jw = J / 2;
  const y0 = 66;
  const Y = (v) => y0 + v * J;
  const capB = Y(0.176);
  const saltT = Y(0.222);
  const labT = Y(0.29);
  const labB = Y(1.044);
  const foot = Y(1.22);
  const sc = J / 244; // the mound, scaled with the jar from the approved plate
  const bow = (y, b = 4) =>
    curve(
      [
        [cx - jw, y],
        [cx - jw * 0.5, y + b * 0.75],
        [cx, y + b],
        [cx + jw * 0.5, y + b * 0.75],
        [cx + jw, y],
      ],
      false,
      3,
    );
  const crest = curve(
    [
      [92, 474],
      [122, 452],
      [148, 438],
      [172, 404],
      [188, 368],
      [214, 358],
      [262, 358],
      [320, 361],
      [378, 358],
      [426, 358],
      [452, 368],
      [468, 404],
      [492, 438],
      [518, 452],
      [548, 474],
    ].map(([x, y]) => [cx + (x - 320) * sc, foot + (y - 368) * sc]),
    false,
    6,
  );
  P.line(
    crest.map((q) => [q[0] + (P.rnd() - 0.5) * 1.6, q[1] + (P.rnd() - 0.5) * 3.6]),
    { w: 1.25, t: 3, amp: 0, swell: true },
  );
  const hp = [...crest, [cx + 228 * sc, H + 2], [cx - 228 * sc, H + 2], crest[0]];
  P.hatch(hp, {
    angle: 60,
    gap: 2.6,
    t: 4,
    shared: true,
    shade: (x, y) => 0.05 + (y - foot) / 130 + (x - cx) / 300,
    over: (x, y) => x > cx + 50 && y > foot + 60,
  });
  P.hatch(hp, {
    angle: 122,
    gap: 2.4,
    t: 5,
    shared: true,
    shade: (x, y) => (y - foot - 40) / 76 + (x - cx - 50) / 200,
  });
  for (let i = 0; i < 16; i++) {
    const x = cx + (P.rnd() - 0.5) * 380 * sc;
    const y = foot + 44 + P.rnd() * 60;
    const r = 1.6 + P.rnd() * 3;
    P.line(
      [
        [x - r, y],
        [x - r * 0.1, y - r * 1.2],
        [x + r, y - r * 0.2],
        [x + r * 0.2, y + r * 0.7],
        [x - r, y],
      ],
      { w: 0.5, t: 6, amp: 0, taper: false },
    );
  }
  P.block(hp);
  P.paper(hp);
  // The jar itself is now drawn from the 3D model (jarLive). These strokes keep the plate's
  // random stream as approved and are left out; their blocks are released again.
  const free = P.blocks();
  P.at('drop');
  // the smooth cap, two fine grooves
  const capPoly = [
    ...curve(
      [
        [cx - jw - 1, y0 + 10],
        [cx - jw + 1, y0 + 4],
        [cx - jw + 8, y0 + 1],
      ],
      false,
      1.5,
    ),
    ...curve(
      [
        [cx - jw + 8, y0 + 1],
        [cx, y0 - 1],
        [cx + jw - 8, y0 + 1],
      ],
      false,
      6,
    ),
    ...curve(
      [
        [cx + jw - 8, y0 + 1],
        [cx + jw - 1, y0 + 4],
        [cx + jw + 1, y0 + 10],
      ],
      false,
      1.5,
    ),
    [cx + jw + 1, capB - 7],
    ...curve(
      [
        [cx + jw + 1, capB - 7],
        [cx + jw - 2, capB - 2],
        [cx + jw - 9, capB],
      ],
      false,
      1.5,
    ),
    ...curve(
      [
        [cx + jw - 9, capB],
        [cx, capB + 4],
        [cx - jw + 9, capB],
      ],
      false,
      6,
    ),
    ...curve(
      [
        [cx - jw + 9, capB],
        [cx - jw + 2, capB - 2],
        [cx - jw - 1, capB - 7],
      ],
      false,
      1.5,
    ),
    [cx - jw - 1, y0 + 10],
  ];
  P.line(capPoly, { w: 1.4, t: 2, amp: 0.08, taper: 'swell', swell: true });
  for (const v of [0.082, 0.118]) P.line(bow(Y(v), 3), { w: 0.5, t: 3, taper: 'ends', amp: 0.05 });
  P.hatch(capPoly, {
    angle: 90,
    gap: 2,
    t: 3,
    shade: (x) => (x - (cx + jw * 0.6)) / 44 + 0.08,
    over: (x) => x > cx + jw - 16,
  });
  P.hatch(capPoly, { angle: 90, gap: 2.6, t: 3, shade: (x) => (cx - jw * 0.84 - x) / 24 });
  P.block(capPoly);
  P.paper(capPoly);
  // the label: one clean rectangle, a hairline border inside it
  const lab = rect(cx - jw, labT, cx + jw, labB);
  P.line(
    [
      [cx - jw, labT],
      [cx + jw, labT],
    ],
    { w: 1, t: 3, amp: 0.1, taper: false },
  );
  P.line(
    [
      [cx - jw, labB],
      [cx + jw, labB],
    ],
    { w: 1, t: 3, amp: 0.1, taper: false },
  );
  P.line(rect(cx - jw + 9, labT + 9, cx + jw - 9, labB - 9), {
    w: 0.5,
    t: 4,
    amp: 0.05,
    taper: false,
  });
  P.hatch(lab, {
    angle: 90,
    gap: 2,
    t: 5,
    shade: (x) => (x - (cx + jw * 0.69)) / 38 + 0.05,
    over: (x) => x > cx + jw - 14,
  });
  P.hatch(lab, { angle: 90, gap: 2.6, t: 5, shade: (x) => (cx - jw * 0.85 - x) / 22 });
  P.block(lab);
  P.paper(lab);
  // the clear jar: rounded shoulder, a flat foot (12.2 : 10 overall)
  const body = curve([
    [cx - jw + 8, capB + 1],
    [cx - jw + 1, capB + 8],
    [cx - jw, capB + 22],
    [cx - jw, Y(0.6)],
    [cx - jw, foot - 18],
    [cx - jw + 3, foot - 7],
    [cx - jw + 14, foot],
    [cx, foot],
    [cx + jw - 14, foot],
    [cx + jw - 3, foot - 7],
    [cx + jw, foot - 18],
    [cx + jw, Y(0.6)],
    [cx + jw, capB + 22],
    [cx + jw - 1, capB + 8],
    [cx + jw - 8, capB + 1],
  ]);
  P.line(body, { w: 1.4, t: 2, amp: 0.1, taper: false, swell: true });
  P.line(
    bow(saltT, 5).map(([x, y]) => [cx + (x - cx) * 0.96, y]),
    { w: 0.75, t: 4, amp: 0.25 },
  );
  const up = [
    [cx - jw + 5, saltT + 1],
    [cx + jw - 5, saltT + 1],
    [cx + jw - 5, labT],
    [cx - jw + 5, labT],
    [cx - jw + 5, saltT + 1],
  ];
  const down = [
    [cx - jw + 5, labB + 1],
    [cx + jw - 5, labB + 1],
    [cx + jw - 5, foot - 3],
    [cx - jw + 5, foot - 3],
    [cx - jw + 5, labB + 1],
  ];
  for (const b of [up, down]) {
    P.hatch(b, {
      angle: 0,
      gap: 2.9,
      t: 5,
      max: 3.5,
      jitter: 0.9,
      shared: true,
      shade: () => P.rnd() * 0.42,
    });
    P.hatch(b, {
      angle: 60,
      gap: 2.4,
      t: 5,
      shared: true,
      shade: (x) => (x - (cx + jw * 0.62)) / 46,
    });
  }
  P.block([...body, body[0]]);
  P.paper([...body, body[0]]);
  P.release(free);
  P.at(4);
  return { crest, foot, jw, sc };
}

/** The sluice, standing in the bund at the near pan's front edge, letting water in. */
function sluice(P, gx, gy, slope) {
  const footL = [gx - 62, gy - slope * 62];
  const footR = [gx + 62, gy + slope * 62];
  const hPost = 70;
  const post = ([x, y]) => {
    const p = rect(x - 5.5, y - hPost, x + 5.5, y + 5);
    P.line(p, { w: 1.25, t: 2, taper: 'swell', swell: true, amp: 0.15 });
    P.hatch(p, { angle: 90, gap: 1.9, t: 3, shade: (u) => 0.3 + (u - x + 5.5) / 13 });
    P.hatch(p, { angle: 20, gap: 2.3, t: 3, shade: (u) => (u - x) / 6 });
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
  const ty = footL[1] - hPost + 6;
  const by = footL[1] - hPost * 0.42;
  const dy = footR[1] - footL[1];
  const gate = [
    [footL[0] + 6, ty],
    [footR[0] - 6, ty + dy],
    [footR[0] - 6, by + dy],
    [footL[0] + 6, by],
    [footL[0] + 6, ty],
  ];
  P.line(gate, { w: 0.75, t: 3, taper: false, amp: 0.1 });
  for (let i = 1; i < 7; i++) {
    const x = lerp(footL[0] + 6, footR[0] - 6, i / 7);
    P.line(
      [
        [x, ty + 0.5 + (dy * i) / 7],
        [x + 0.3, by + (dy * i) / 7 - 0.5],
      ],
      { w: 0.5, t: 4, taper: false, amp: 0.05 },
    );
  }
  P.hatch(gate, { angle: 88, gap: 1.8, t: 4, shared: true, shade: (u, v) => (v - ty) / (by - ty) });
  P.hatch(gate, {
    angle: 14,
    gap: 2.2,
    t: 4,
    shared: true,
    shade: (u, v) => (v - ty) / (by - ty) - 0.35,
  });
  P.block(gate);
  const open = [
    [footL[0] + 6, by],
    [footR[0] - 6, by + dy],
    [footR[0] - 6, footR[1]],
    [footL[0] + 6, footL[1]],
    [footL[0] + 6, by],
  ];
  P.hatch(open, { angle: 90, gap: 2.1, t: 4, shared: true, shade: () => 0.75, jitter: 0.6 });
  P.block(open);
  // the fan of ripples the sluice sends into the near pan
  for (let i = 1; i <= 7; i++) {
    const rx = 28 + i * 25;
    const ry = 5 + i * 5;
    const arc = [];
    for (let k = -1; k <= 1.001; k += 0.08)
      arc.push([gx + Math.sin(k * 1.35) * rx, gy - 5 - Math.cos(k * 1.35) * ry]);
    P.line(arc, { w: i < 3 ? 1 : 0.75, t: 5, amp: 0.3 });
  }
}

/** One feeder canal: two banks narrowing to the horizon, water running down it. */
function canal(P, layer, i, yTop, yBottom, wTop, wBottom) {
  const x = canalX(layer, i);
  const half = (y) => lerp(wTop, wBottom, (y - yTop) / (yBottom - yTop));
  const bank = (sign) => {
    const pts = [];
    for (let y = yTop; y <= yBottom + 0.01; y += (yBottom - yTop) / 8)
      pts.push([x + sign * half(y), y]);
    return pts;
  };
  const left = bank(-1);
  const right = bank(1);
  const poly = [...left, ...right.slice().reverse(), left[0]];
  P.at(i);
  P.line(left, { w: 1, t: 6, amp: 0.5 });
  P.at(i + 1);
  P.line(right, { w: 0.75, t: 6, amp: 0.5 });
  P.at(i);
  for (let y = yTop + 4, g = 4; y < yBottom; y += g, g += 0.42) {
    P.ripple(x - half(y) + 2, x + half(y) - 2, y, { seg: 8 + half(y) * 0.5, t: 7 });
  }
  P.block(poly);
}

/* ------------------------------------------------------------------------------------------
 * Living details. What moves is drawn into small overlays (the page animates only transform,
 * opacity and stroke-dashoffset); the plates keep everything that stays still.
 * ---------------------------------------------------------------------------------------- */
const LIVE = {};
const r1 = (v) => Math.round(v * 10) / 10;
const bbox = (pts, pad = 0) => {
  const xs = pts.map((q) => q[0]);
  const ys = pts.map((q) => q[1]);
  const x = Math.min(...xs) - pad;
  const y = Math.min(...ys) - pad;
  return [r1(x), r1(y), r1(Math.max(...xs) + pad - x), r1(Math.max(...ys) + pad - y)];
};
/** A plate's paths without the <svg> around them. */
const inner = (P) =>
  P.svg('')
    .replace(/^<svg[^>]*>|<\/svg>$/g, '')
    .replace(/ data-m="\d+"/g, '');
/** Strokes drawn only to keep a plate's random stream as approved, then left out. */
const drop = (svg) => svg.replace(/<g data-s="drop">.*?<\/g>/, '');
const dash = ([x, y, l, dy = 0]) => `M${r1(x)} ${r1(y)}l${r1(l)} ${r1(dy)}`;

/** 01: water lines running from the channel to the sluice's opening (dash offset, scrolled). */
function flowLive(gx, gy) {
  const d = [];
  for (let j = -3; j <= 3; j++)
    d.push(
      `M${r1(gx + j * 24)} ${r1(gy + 96)}Q${r1(gx + j * 15)} ${r1(gy + 44)} ${r1(gx + j * 7)} ${r1(gy + 3)}`,
    );
  return {
    layer: 'near',
    s: 0,
    box: bbox([
      [gx - 80, gy - 2],
      [gx + 80, gy + 100],
    ]),
    d,
  };
}

/** 01: one ripple ring (scaled out from the gate), and the gate it passes behind. */
function ringsLive(gx, gy, slope) {
  const rx = 180;
  const ry = 36;
  const arc = [];
  for (let k = -1; k <= 1.001; k += 0.08)
    arc.push([r1(Math.sin(k * 1.35) * rx), r1(-Math.cos(k * 1.35) * ry)]);
  const lift = Math.abs(slope) * 62;
  return {
    layer: 'near',
    s: 0,
    box: bbox([
      [gx - rx - 6, gy - 5 - ry - 6],
      [gx + rx + 6, gy + 8],
    ]),
    o: [r1(gx), r1(gy - 5)],
    d: 'M' + arc.map((q) => q.join(' ')).join('L'),
    hole: [r1(gx - 78), r1(gy - lift - 92), r1(gx + 78), r1(gy + 8)],
  };
}

/** 02: the pans' water dashes (they shorten and thin out) and the crystals left behind. */
function evapLive(list) {
  const mine = inBlock('near', 1);
  list = list.filter(([x, y, l]) => mine([x, y]) && mine([x + l, y]));
  const dashes = list.map(([x, y, l, dy]) => [r1(x), r1(y), r1(l), r1(dy)]);
  const crystals = list.map(([x, y, l, , zm]) => [
    r1(x + l / 2),
    r1(y),
    r1(clamp(64 / zm, 1.4, 3.4)),
  ]);
  return {
    layer: 'near',
    s: 1,
    box: bbox(
      list.flatMap(([x, y, l]) => [
        [x, y],
        [x + l, y],
      ]),
      6,
    ),
    dashes,
    crystals,
  };
}

/** 03: the rake (handle and board, own groups) and the furrows it leaves. */
function rakeLive(R, { board, y0, top, right }) {
  const bl = Math.min(...board.map((q) => q[0]));
  const yb = Math.max(...board.map((q) => q[1]));
  const z = E / (yb - HZ);
  const dx = r1(0.15 * ((372 * ZREF) / z)); // 15% of the pan's width at the board's depth
  // the board's lower edge: from its bottom-left corner to its bottom-right one
  const e0 = board[3];
  const e1 = board[2];
  const furrows = [0, 1, 2, 3].map((k) => {
    const t = (k + 0.5) / 4;
    return [r1(lerp(e0[0], e1[0], t)), r1(lerp(e0[1], e1[1], t)), dx, 0];
  });
  return {
    layer: 'near',
    s: 2,
    box: bbox([
      [bl - 8, top - 8],
      [right + dx + 10, y0 + 12],
    ]),
    html: inner(R),
    dx,
    furrows,
  };
}

/** 03: the figure's reflection, as two sets of alternate rows that drift against each other. */
function shimmerLive({ flip, y0 }) {
  const rnd = Plate(406).rnd;
  const [, top, , h] = bbox(flip);
  const sets = [[], []];
  let row = 0;
  for (let y = top + 1.2; y < top + h; y += 2.7, row++) {
    const xs = [];
    for (let i = 0, j = flip.length - 1; i < flip.length; j = i++) {
      const p = flip[i];
      const q = flip[j];
      if (p[1] > y !== q[1] > y) xs.push(p[0] + ((y - p[1]) / (q[1] - p[1])) * (q[0] - p[0]));
    }
    xs.sort((u, v) => u - v);
    const shade = 1 - (y - y0) / 110;
    for (let k = 0; k + 1 < xs.length; k += 2)
      for (let x = xs[k] + rnd() * 2; x < xs[k + 1] - 2;) {
        const l = Math.min(4 + rnd() * 9, xs[k + 1] - x);
        if (l > 2 && rnd() < shade + 0.15) sets[row % 2].push(dash([x, y, l, (rnd() - 0.5) * 0.5]));
        x += l + 1.5 + rnd() * 2.5;
      }
  }
  const paper = 'M' + flip.map(([x, y]) => `${r1(x)} ${r1(y)}`).join('L') + 'Z';
  return {
    layer: 'near',
    s: 2,
    box: bbox(flip, 4),
    paper,
    a: sets[0].join(''),
    b: sets[1].join(''),
  };
}

/** 05: glints on the salt heap, clear of the jar. */
function glintsLive({ crest, foot, jw, sc }, cx) {
  const rnd = Plate(505).rnd;
  const crestY = (x) => {
    for (let i = 1; i < crest.length; i++)
      if (crest[i][0] >= x)
        return lerp(
          crest[i - 1][1],
          crest[i][1],
          (x - crest[i - 1][0]) / (crest[i][0] - crest[i - 1][0] || 1),
        );
    return H;
  };
  const pts = [];
  for (let n = 0; pts.length < 8 && n < 2000; n++) {
    const x = cx + (rnd() - 0.5) * 2 * 196 * sc;
    const y = foot + 10 + rnd() * 92;
    if (y < crestY(x) + 7) continue;
    if (Math.abs(x - cx) < jw + 6 && y < foot + 6) continue;
    if (pts.some((q) => Math.hypot(q[0] - x, q[1] - y) < 34)) continue;
    pts.push([r1(x), r1(y), r1(2.6 + rnd() * 1.6)]);
  }
  return { layer: 'far', s: 4, pts };
}

/**
 * 01: flamingos crossing the dawn sky. Each bird faces right: long neck forward, legs trailing,
 * a few lines; two wing positions to beat between. In the far layer, so they pass in front of
 * the sun.
 */
function birdsLive(c0) {
  // neck 1 : body 0.6 : legs 1.1, a long horizontal cross; wide wings at the middle
  const body = 'M-4.2 0C-2.6-1.7 2.6-1.8 4.2-.4C2.6 1.2-2.6 1.4-4.2 0Z';
  const neck = 'M4.1-.5L18.1-.9';
  const head = 'M18.1-.9C18.6-1.7 19.6-1.6 19.9-.9L20.6.9M18.1-.2L19.8 0';
  const legs = 'M-4 .2L-19.4.8M-3.8.7L-19.2 1.4';
  const pts = (list, s) => 'M' + list.map(([x, y]) => `${x} ${+(y * s).toFixed(2)}`).join('L');
  const near = [
    [2.4, -1.2],
    [1.2, -6],
    [-1.5, -11.5],
    [-3.3, -10.5],
    [-3.5, -6],
    [-2, -1.3],
  ];
  const far = [
    [1, -1.5],
    [-1, -5.8],
    [-4.6, -10],
    [-5.9, -9],
    [-5.1, -5.4],
    [-3.2, -1.6],
  ];
  const wings = (s, sf) =>
    `<path class="a" opacity=".6" d="${pts(far, sf)}"/>` +
    `<path class="c" opacity=".6" d="${pts(far.slice(2, 4), sf)}"/>` +
    `<path class="b" d="${pts(near, s)}"/>` +
    `<path class="c" d="${pts(near.slice(2, 4), s)}"/>`;
  const still =
    `<path class="b" d="${body}"/><path class="b" d="${neck}"/>` +
    `<path class="a" d="${head}"/><path class="a" d="${legs}"/>`;
  return {
    layer: 'far',
    s: 0,
    x: r1(c0 - 340),
    y: 92,
    travel: 560,
    scale: 0.85,
    vb: [-21, -13, 42, 25],
    flock: [
      [0, 0],
      [-40, 10],
      [-74, -2],
      [-28, -14],
    ],
    up: wings(1, 1) + still,
    down: still + wings(-0.85, -0.7),
  };
}

/**
 * 05: the jar, from the 3D model and the hero camera's first frame (jar3d.mjs), standing on its
 * heap: outline, cap rim, groove and bottom, shoulder, label edges (an inset hairline inside
 * them), base. Its own overlay, so it can glide to where the 3D jar appears (Journey step 2).
 */
function jarLive(cx, foot) {
  const J = projectJar();
  const ys = J.outline.map((q) => q[1]);
  const top = Math.min(...ys);
  const bottom = Math.max(...ys);
  const kp = 333 / (bottom - top); // the same height as the approved plate's jar
  const ax = J.anchors.base[0];
  const map = ([x, y]) => [cx + (x - ax) * kp, foot + (y - bottom) * kp];
  const outline = J.outline.map(map);
  const E = Object.fromEntries(Object.entries(J.edges).map(([k, v]) => [k, v.map(map)]));
  const xs = outline.map((q) => q[0]);
  const jw = (Math.max(...xs) - Math.min(...xs)) / 2;
  const jc = (Math.max(...xs) + Math.min(...xs)) / 2;
  const Pj = Plate(707, { vignette: false, width: L.far.width });
  const band = (a, b) => [...a, ...[...b].reverse(), a[0]];

  Pj.paper([...outline, outline[0]]);
  Pj.line([...outline, outline[0]], { w: 1.4, t: 2, amp: 0.08, taper: false, swell: true });
  Pj.line(E.capRim, { w: 0.75, t: 3, amp: 0.05, taper: 'ends' });
  Pj.line(E.capGroove, { w: 0.5, t: 3, amp: 0.05, taper: 'ends' });
  Pj.line(E.capBottom, { w: 1, t: 2, amp: 0.05, taper: false });
  Pj.line(E.shoulder, { w: 0.75, t: 3, amp: 0.05, taper: 'ends' });
  Pj.line(E.labelTop, { w: 1, t: 3, amp: 0.05, taper: false });
  Pj.line(E.labelBottom, { w: 1, t: 3, amp: 0.05, taper: false });
  Pj.line(E.base, { w: 0.75, t: 4, amp: 0.1, taper: 'ends' });
  // the label's hairline border, 9 units inside its edges
  const inset = (arc, dy) =>
    arc.filter(([x]) => x > jc - jw + 9 && x < jc + jw - 9).map(([x, y]) => [x, y + dy]);
  const iTop = inset(E.labelTop, 9);
  const iBot = inset(E.labelBottom, -9);
  Pj.line([...iTop, ...[...iBot].reverse(), iTop[0]], { w: 0.5, t: 4, amp: 0.05, taper: false });

  // tone, as the approved plate: the cap and label shaded on the right, glass lightly hatched
  const cap = band(E.capRim, E.capBottom);
  Pj.hatch(cap, {
    angle: 90,
    gap: 2,
    t: 3,
    shade: (x) => (x - (jc + jw * 0.6)) / 44 + 0.08,
    over: (x) => x > jc + jw - 16,
  });
  Pj.hatch(cap, { angle: 90, gap: 2.6, t: 3, shade: (x) => (jc - jw * 0.84 - x) / 24 });
  const lab = band(E.labelTop, E.labelBottom);
  Pj.hatch(lab, {
    angle: 90,
    gap: 2,
    t: 5,
    shade: (x) => (x - (jc + jw * 0.69)) / 38 + 0.05,
    over: (x) => x > jc + jw - 14,
  });
  Pj.hatch(lab, { angle: 90, gap: 2.6, t: 5, shade: (x) => (jc - jw * 0.85 - x) / 22 });
  for (const g of [band(E.shoulder, E.labelTop), band(E.labelBottom, E.base)]) {
    Pj.hatch(g, {
      angle: 0,
      gap: 2.9,
      t: 5,
      max: 3.5,
      jitter: 0.9,
      shared: true,
      shade: () => Pj.rnd() * 0.42,
    });
    Pj.hatch(g, {
      angle: 60,
      gap: 2.4,
      t: 5,
      shared: true,
      shade: (x) => (x - (jc + jw * 0.62)) / 46,
    });
  }
  const r2 = (q) => q.map((v) => Math.round(v * 10) / 10);
  return {
    outline,
    live: {
      layer: 'far',
      s: 4,
      box: bbox(outline, 6),
      html: inner(Pj),
      // where the page aligns it with the 3D jar (the same points projected live)
      anchors: { base: r2(map(J.anchors.base)), top: r2(map(J.anchors.top)) },
      model: { jarX: CAM.jarX, jarY: CAM.jarY, top: Math.round(J.heights.lidY1 * 1e5) / 1e5 },
    },
  };
}

/** The near layer's pans, one block per scene: double bunds, brine, a patchwork of toned pans. */
function nearPans(P, skip, evap) {
  const T = 7;
  for (let s = 0; s < 5; s++) {
    P.at(s);
    P.within(inBlock('near', s));
    NEAR_ROWS.forEach(([z0, z1], r) => {
      COLS.forEach((c) => {
        const q = [
          fan('near', s, c.x0, z0),
          fan('near', s, c.x1, z0),
          fan('near', s, c.x1, z1),
          fan('near', s, c.x0, z1),
        ];
        q.push(q[0]);
        const cx = (q[0][0] + q[2][0]) / 2;
        const half = 760;
        if (Math.abs(cx - L.near.centers[s]) > half + (s === 0 || s === 4 ? 700 : 0)) return;
        if (skip(s, r)) return;
        if (r < 1) {
          P.line([q[0], q[1]], { w: 1.4, t: T, amp: 0.3 });
          P.line([q[1], q[2]], { w: 1, t: T, amp: 0.3 });
          P.line([q[2], q[3]], { w: 0.75, t: T, amp: 0.3 });
          P.line([q[3], q[0]], { w: 1, t: T, amp: 0.3 });
        } else {
          P.rule(q[0], q[1], { w: r < 2 ? 1 : 0.75, t: T });
          P.rule(q[1], q[2], { w: 0.75, t: T });
          P.rule(q[2], q[3], { w: 0.5, t: T });
          P.rule(q[3], q[0], { w: 0.75, t: T });
        }
        const zm = (z0 + z1) / 2;
        if ((c.i * 7 + r * 5) % 5 === 0) {
          P.hatch(q, {
            angle: 0,
            gap: clamp(170 / zm, 3.4, 6.2),
            t: T + 1,
            shared: true,
            jitter: 0.25,
            max: 120,
            shade: () => 0.75,
          });
        } else {
          const xs = q.map((v) => v[0]);
          const ys = q.map((v) => v[1]);
          const n = Math.round(clamp(150 / zm, 2, 8));
          for (let k = 0; k < n; k++) {
            const x = lerp(Math.min(...xs), Math.max(...xs), P.rnd());
            const y = lerp(Math.min(...ys), Math.max(...ys), P.rnd());
            const l = 6 + 240 / zm;
            if (inside(q, [x, y]) && inside(q, [x + l, y])) {
              const dy = (P.rnd() - 0.5) * 0.7;
              if (s === 1 && evap) evap.push([x, y, l, dy, zm]);
              else P.rule([x, y], [x + l, y + dy], { w: 0.5, t: T + 1 });
            }
          }
        }
        // the bund's shaded flank, behind this pan
        if (r < 2 && !skip(s, r + 1)) {
          const next = NEAR_ROWS[r + 1][0];
          const f = [
            fan('near', s, c.x0, z1 + 0.02),
            fan('near', s, c.x1, z1 + 0.02),
            fan('near', s, c.x1, next - 0.02),
            fan('near', s, c.x0, next - 0.02),
          ];
          f.push(f[0]);
          P.hatch(f, {
            angle: 76,
            gap: 2.6,
            t: T + 1,
            shared: true,
            shade: (x) => 0.42 + 0.3 * Math.sin(x * 0.04),
          });
        }
        if (c.channel) {
          for (const k of [0.3, 0.66]) {
            const X = c.x1 + 52 * k;
            P.rule(fan('near', s, X, z0), fan('near', s, X, z1), { w: 0.5, t: T + 1 });
          }
        }
      });
    });
  }
  P.within(null);
}

function buildNear() {
  const P = Plate(101, { vignette: false, width: L.near.width });
  const C = L.near.centers;
  // 05's foreground is kept clear: the jar and its heap live in the far layer
  P.at(4);
  const jarX = C[4] + JAR_DX;
  P.block(rect(jarX - 340, 262, jarX + 340, H + 4));
  // 04
  P.at(3);
  carrier(P, C[3] - 70, 432);
  mound(P, C[3] + 186, 392, 56, 84, { t: 4 });
  // 03
  P.at(2);
  const R = Plate(404, { vignette: false, width: L.near.width });
  const rk = raker(P, C[2] + 70, 428, R);
  LIVE.rake = rakeLive(R, rk);
  LIVE.shimmer = shimmerLive(rk);
  mound(P, C[2] + 198, 440, 44, 74, { t: 4 });
  // 01: the sluice in the bund, the foreground channel it draws from
  P.at(0);
  const gx = C[0] - 40;
  const a = onRow('near', 0, gx - 100, 24.9);
  const b = onRow('near', 0, gx + 100, 24.9);
  const slope = (b[1] - a[1]) / (b[0] - a[0]);
  const gy = lerp(a[1], b[1], 0.5);
  sluice(P, gx, gy, slope);
  LIVE.flow = flowLive(gx, gy);
  LIVE.rings = ringsLive(gx, gy, slope);
  // the feeder canals between the blocks of pans
  for (let i = 0; i < 4; i++) canal(P, 'near', i, HZ + 81, H + 4, 9, 52);
  P.at(0);
  P.within(inBlock('near', 0));
  for (let y = gy + 18, g = 6; y < 508; y += g, g += 1.1)
    P.ripple(-40, canalX('near', 0), y, {
      seg: 22 + (y - gy) * 0.4,
      t: 7,
      w: 0.5,
      swell: y > gy + 70,
    });
  P.within(null);
  // the first row of pans gives way to that channel across scene 01
  const evap = [];
  nearPans(P, (s, r) => s === 0 && r === 0, evap);
  LIVE.evap = evapLive(evap);
  return drop(P.svg(STYLE));
}

function buildFar() {
  const P = Plate(202, { vignette: false, width: L.far.width });
  const C = L.far.centers;
  // the jar, on its heap, at dusk
  P.at(4);
  const heap = jar(P, C[4] + JAR_DX);
  LIVE.glints = glintsLive(heap, C[4] + JAR_DX);
  const J = jarLive(C[4] + JAR_DX, heap.foot);
  P.block([...J.outline, J.outline[0]]); // what stands behind the jar stops at its outline
  LIVE.jar = J.live;
  LIVE.birds = birdsLive(C[0]);
  // far mounds per scene: [dx, base y, radius, height]
  const groups = [
    [
      [-310, 262, 46, 58],
      [300, 256, 40, 50],
      [-120, 244, 30, 36],
    ],
    [
      [-200, HZ, 42, 42],
      [-272, HZ, 24, 24],
      [-118, HZ, 26, 26],
      [130, HZ, 34, 34],
      [214, HZ, 46, 46],
      [282, HZ, 19, 19],
    ],
    [
      [-260, 264, 54, 78],
      [-60, 244, 36, 50],
      [150, 236, 30, 42],
      [330, 250, 36, 50],
    ],
    [
      [-300, 252, 40, 58],
      [40, 236, 30, 44],
      [240, 246, 36, 52],
    ],
    [
      [-330, 254, 30, 40],
      [-120, 246, 24, 32],
    ],
  ];
  groups.forEach((g, i) => {
    P.at(i);
    g.forEach(([dx, y, r, h]) => {
      mound(P, C[i] + dx, y, r, h, { t: 4, fine: y === HZ ? 2 : 2.2 });
      if (y - h < HZ)
        P.paper([
          [C[i] + dx - r, y],
          [C[i] + dx, y - h],
          [C[i] + dx + r, y],
          [C[i] + dx - r, y],
        ]);
    });
  });
  // the canals run on towards the horizon
  for (let i = 0; i < 4; i++) canal(P, 'far', i, HZ + 46, HZ + 81, 4, 9);
  // one unbroken horizon, stopping only at what stands in front of it
  P.at('h');
  P.line(
    [
      [-20, HZ],
      [L.far.width + 20, HZ],
    ],
    { w: 1, t: 1, amp: 0, taper: false },
  );
  // far brine between the grid and the horizon: fine level lines
  for (let i = 0; i < 5; i++) {
    P.at(i);
    const x0 = i === 0 ? -20 : canalX('far', i - 1);
    const x1 = i === 4 ? L.far.width + 20 : canalX('far', i);
    for (let d = 3.5; d < 19; d += 3.2) P.rule([x0, HZ + d], [x1, HZ + d], { w: 0.5, t: 8 });
  }
  // each block's far pans: rows across it, columns fanning to its vanishing point
  for (let s = 0; s < 5; s++) {
    P.at(s);
    P.within(inBlock('far', s));
    const left = s === 0 ? -20 : canalX('far', s - 1);
    const right = s === 4 ? L.far.width + 20 : canalX('far', s);
    for (let z = SEAM_Z; z < 216; z += z < 104 ? 13.2 : 28) {
      const pts = [];
      for (let k = 0; k <= 8; k++) pts.push(onRow('far', s, lerp(left, right, k / 8), z));
      P.line(pts, { w: z > 130 ? 0.5 : 0.75, t: 7, amp: 0, taper: false });
    }
    for (let d = -5280; d <= 5280; d += 96) {
      const a = fan('far', s, d, SEAM_Z);
      const b = fan('far', s, d, 132);
      if (Math.max(a[0], b[0]) < left - 30 || Math.min(a[0], b[0]) > right + 30) continue;
      P.rule(a, b, { w: 0.5, t: 7 });
    }
  }
  P.within(null);
  return drop(P.svg(STYLE));
}

/** A sky for each hour: no repeated band. Neighbours fade into each other. */
function buildSky() {
  const P = Plate(303, { vignette: false, width: L.sky.width });
  const C = L.sky.centers;
  const sp = S * SPEEDS.sky;
  const win = (i) => (x) => {
    const d = Math.abs(x - C[i]) / sp;
    if ((i === 0 && x < C[0]) || (i === 4 && x > C[4])) return 1;
    return 1 - smooth(0.26, 0.74, d);
  };
  const up = (y) => clamp((HZ - y) / HZ);
  const box = (i) => {
    const a = i === 0 ? -30 : C[i] - sp * 0.76;
    const b = i === 4 ? L.sky.width + 30 : C[i] + sp * 0.76;
    return rect(a, 14, b, HZ - 8);
  };
  // 01 dawn: long level lines, closing up towards the top, light along the horizon
  P.at(0);
  let w = win(0);
  P.hatch(box(0), {
    angle: 0,
    gap: 9.3,
    t: 9,
    shared: true,
    jitter: 0.4,
    max: 260,
    shade: (x, y) => w(x) * (up(y) ** 1.5 * 0.95 + 0.05),
  });
  // 02 morning: few lines, opening out as the day clears
  P.at(1);
  const w1 = win(1);
  P.hatch(box(1), {
    angle: 0,
    gap: 18,
    t: 9,
    shared: true,
    jitter: 0.6,
    max: 200,
    shade: (x, y) => w1(x) * (0.15 + up(y) * 0.5),
  });
  // 03 midday: a nearly open sky, a few high wisps
  P.at(2);
  const w2 = win(2);
  const wisps = [
    [-300, 60, 150, 16],
    [-30, 34, 120, 12],
    [260, 74, 170, 15],
    [120, 112, 90, 9],
  ];
  P.hatch(box(2), {
    angle: 0,
    gap: 3.4,
    t: 9,
    shared: true,
    jitter: 0.5,
    max: 70,
    shade: (x, y) =>
      w2(x) *
      Math.max(
        ...wisps.map(
          ([dx, wy, rx, ry]) => 1.05 - ((x - C[2] - dx) / rx) ** 2 - ((y - wy) / ry) ** 2,
        ),
      ),
  });
  // 04 afternoon: fine slanting light from the upper left
  P.at(3);
  const w3 = win(3);
  P.hatch(box(3), {
    angle: 16,
    gap: 14,
    t: 9,
    shared: true,
    jitter: 0.4,
    max: 150,
    shade: (x, y) => w3(x) * (up(y) * 0.72 - 0.02),
  });
  // 05 dusk: close level lines down the whole sky, crossed high up
  P.at(4);
  const w4 = win(4);
  P.hatch(box(4), {
    angle: 0,
    gap: 8.3,
    t: 9,
    shared: true,
    jitter: 0.25,
    max: 300,
    shade: (x, y) => w4(x) * (0.3 + up(y) * 0.8),
  });
  P.hatch(box(4), {
    angle: 12,
    gap: 16,
    t: 9,
    shared: true,
    jitter: 0.3,
    max: 170,
    shade: (x, y) => w4(x) * (up(y) - 0.42) * 1.5,
  });
  return P.svg(STYLE);
}

// For <img> use (reduced motion): the same hairlines at any size. The page strips this when it
// inlines the layers, because stroke-dash needs user-space stroke widths.
const STYLE =
  '<style>.p{fill:#f5f1e8;stroke:none}path{vector-effect:non-scaling-stroke;stroke-width:.75px}.a{stroke-width:.5px}.b{stroke-width:1px}.c{stroke-width:1.25px}.d{stroke-width:1.4px}</style>';

mkdirSync(OUT, { recursive: true });
let total = 0;
for (const [name, fn] of [
  ['sky', buildSky],
  ['far', buildFar],
  ['near', buildNear],
]) {
  const f = join(OUT, `journey-${name}.svg`);
  writeFileSync(f, fn());
  const kb = statSync(f).size / 1024;
  total += kb;
  console.log(`journey-${name}.svg`, kb.toFixed(1) + ' KB');
}
console.log('total', total.toFixed(1), 'KB');

writeFileSync(
  CONSTS,
  `// Generated by tools/engravings/build.mjs (npm run engravings). Do not edit by hand.
export const PANORAMA = ${JSON.stringify({ height: H, horizon: HZ, scene: S, jarDx: JAR_DX, layers: L }, null, 2)} as const;

/** The living details: geometry in each layer's plate units. */
export const LIVE = ${JSON.stringify(LIVE)} as const;
`,
);
