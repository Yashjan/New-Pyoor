// "05 · The fire" (components/sections/Fire): how the black salt is made, five engraved frames in
// the same gold-line style as the Journey and the pans. Called by build.mjs (npm run
// engravings); also runs on its own: node tools/engravings/fire.mjs
//
//   public/engravings/fire-{1..5}.svg   640 × 480 each:
//     1 lake salt heaped in a shallow brass vessel (paraat)
//     2 hands mixing it with harad, baheda, amla and strips of babul bark
//     3 a row of sealed clay pots set into the bhatti (a low earthen kiln)
//     4 the bhatti burning: stacked cow-dung cakes (kande) round the pots; <g data-s="flame">
//       holds the flame strokes (they flicker), <g data-sparks> the sparks
//     5 the salt, glassy lumps on a cloth, one broken with a stone, ground grains beside it;
//       <g data-fill="lumps">, <g data-fill="dark"> and <g data-fill="ground"> are the fills (the
//       grains' colour crossfades from dark to ground)
// Every stroke keeps its data-t (outlines low, hatching high): the section draws each frame the
// way it was cut. Seeded, so the output is repeatable.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Plate, curve, here, lerp, mound } from './engrave.mjs';

const OUT = join(here, '../../public/engravings');
const W = 640;
const H = 480;
const STYLE =
  '<style>.p{fill:#f5f1e8;stroke:none}path{vector-effect:non-scaling-stroke;stroke-width:.75px}.a{stroke-width:.5px}.b{stroke-width:1px}.c{stroke-width:1.25px}.d{stroke-width:1.4px}</style>';
const GROUND = 404;

/** An ellipse's points (centre, radii), from angle a0 to a1 (0 = right, π/2 = front). */
const arc = (cx, cy, rx, ry, a0 = 0, a1 = Math.PI * 2, n = 64) =>
  Array.from({ length: n + 1 }, (_, i) => {
    const a = lerp(a0, a1, i / n);
    return [cx + rx * Math.cos(a), cy + ry * Math.sin(a)];
  });
const R = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];

/** The ground: a level line and short strokes beneath it, fading out. */
function ground(P, x0 = 40, x1 = 600) {
  P.line(
    [
      [x0, GROUND],
      [x1, GROUND + 1],
    ],
    { w: 1, t: 1, amp: 0.4 },
  );
  for (let i = 0; i < 9; i++)
    P.ripple(x0 + 30 + i * 6, x1 - 30 - i * 6, GROUND + 8 + i * 7, { t: 8, seg: 26 - i });
}

/** A shallow brass vessel (paraat) at cx, its rim at rimY; returns the inside of its rim. */
function paraat(P, cx, rimY, rx, ry, depth) {
  const front = arc(cx, rimY, rx, ry, 0, Math.PI);
  const back = arc(cx, rimY, rx, ry, Math.PI, Math.PI * 2);
  const baseY = rimY + depth;
  const body = [
    ...front,
    ...curve([
      [cx - rx, rimY],
      [cx - rx * 0.9, rimY + depth * 0.7],
      [cx - rx * 0.62, baseY + ry * 0.55],
      [cx, baseY + ry * 0.7],
      [cx + rx * 0.62, baseY + ry * 0.55],
      [cx + rx * 0.9, rimY + depth * 0.7],
      [cx + rx, rimY],
    ]).reverse(),
  ];
  P.line(front, { w: 1.25, t: 1, swell: true });
  P.line(arc(cx, rimY + 5, rx - 4, ry - 2, 0.15, Math.PI - 0.15), { w: 0.5, t: 3 });
  P.shape(body.slice(front.length), { w: 1, t: 2 });
  // the brass: curved hatching, darkest at the right and underneath
  P.hatch(body, {
    angle: 8,
    gap: 2.2,
    t: 6,
    shade: (x, y) => 0.15 + ((x - cx) / rx) * 0.8 + ((y - rimY) / depth) * 0.4,
    over: (x) => x > cx + rx * 0.5,
  });
  P.block(body);
  return { back, front };
}

/** Crystals: small four-sided outlines over a region. */
function crystals(P, n, at, size = 5) {
  for (let i = 0; i < n; i++) {
    const [x, y] = at(P.rnd());
    const s = size * (0.6 + P.rnd() * 0.8);
    const a = P.rnd() * Math.PI;
    const pts = [0, 1, 2, 3].map((k) => {
      const r = k % 2 ? s * 0.55 : s;
      return [x + r * Math.cos(a + (k * Math.PI) / 2), y + r * Math.sin(a + (k * Math.PI) / 2)];
    });
    P.line([...pts, pts[0]], { w: 0.5, t: 4, amp: 0.05, taper: false });
  }
}

/* ---------------- 1: lake salt in the vessel ---------------- */
function one() {
  const P = Plate(5101, { vignette: false, width: W, height: H });
  const cx = 320;
  const rimY = 318;
  crystals(P, 26, () => [cx - 120 + P.rnd() * 240, rimY - 6 - P.rnd() * 70], 5);
  mound(P, cx, rimY + 4, 150, 128, { t: 2 });
  const v = paraat(P, cx, rimY, 196, 36, 46);
  P.line(v.back, { w: 1, t: 2 });
  // a few crystals spilled on the ground
  crystals(P, 12, () => [140 + P.rnd() * 360, GROUND - 3 - P.rnd() * 6], 3.5);
  ground(P);
  return P.svg(STYLE);
}

/* ---------------- 2: mixing in the fruits and the bark ---------------- */
function fruit(P, x, y, kind) {
  if (kind === 'amla') {
    const c = arc(x, y, 9, 8.5);
    P.shape(c, { w: 1, t: 2 });
    for (let k = 0; k < 3; k++)
      P.line(
        curve([
          [x - 6 + k * 6, y - 8],
          [x - 4 + k * 4, y],
          [x - 6 + k * 6, y + 8],
        ]),
        { w: 0.5, t: 5 },
      );
    P.hatch(c, { angle: 120, gap: 2, t: 6, shade: (xx) => (xx - x) / 9 + 0.2 });
    P.block(c);
  } else if (kind === 'harad') {
    const c = arc(x, y, 6, 12);
    P.shape(c, { w: 1, t: 2 });
    for (const dx of [-2.5, 0, 2.5])
      P.line(
        [
          [x + dx, y - 10],
          [x + dx * 1.2, y + 10],
        ],
        { w: 0.5, t: 5 },
      );
    P.block(c);
  } else {
    const c = arc(x, y, 8, 9.5);
    P.shape(c, { w: 1, t: 2 });
    P.line(
      [
        [x - 3, y - 2],
        [x + 2, y - 5],
      ],
      { w: 0.5, t: 5 },
    );
    P.hatch(c, { angle: 60, gap: 1.8, t: 6, shade: (xx, yy) => (xx - x) / 8 + (yy - y) / 10 });
    P.block(c);
  }
}
function bark(P, x, y, len, ang) {
  const c = Math.cos(ang);
  const s = Math.sin(ang);
  const at = (u, v) => [x + u * c - v * s, y + u * s + v * c];
  const pts = [
    at(0, -5),
    at(len * 0.5, -6),
    at(len, -4.5),
    at(len + 2, 0),
    at(len, 5),
    at(len * 0.5, 6),
    at(0, 5),
  ];
  P.shape(pts, { w: 1, t: 2, amp: 0.4 });
  for (const v of [-2.5, 0, 2.5])
    P.line([at(3, v), at(len * 0.45, v + 0.6), at(len - 3, v)], { w: 0.5, t: 5, amp: 0.5 });
  P.block([...pts, pts[0]]);
}
function hand(P, wx, wy, tx, ty) {
  // a forearm from the wrist (wx, wy) out of the frame, the hand reaching to (tx, ty)
  const dx = tx - wx;
  const dy = ty - wy;
  const L = Math.hypot(dx, dy);
  const ux = dx / L;
  const uy = dy / L;
  const nx = -uy;
  const ny = ux;
  const at = (u, v) => [wx + ux * u + nx * v, wy + uy * u + ny * v];
  const palm = curve([
    at(0, -15),
    at(L * 0.55, -19),
    at(L * 0.95, -12),
    at(L, 0),
    at(L * 0.95, 13),
    at(L * 0.5, 18),
    at(0, 15),
  ]);
  P.shape(palm, { w: 1.25, t: 1 });
  for (const v of [-9, -3, 3, 9]) P.line([at(L * 0.62, v), at(L * 0.9, v * 0.8)], { w: 0.5, t: 4 });
  const arm = [at(0, -15), at(-220, -24), at(-220, 24), at(0, 15)];
  P.line([arm[0], arm[1]], { w: 1.25, t: 1, taper: false });
  P.line([arm[2], arm[3]], { w: 1.25, t: 1, taper: false });
  P.hatch([...palm, ...arm.slice(1, 3)], {
    angle: 30,
    gap: 2.4,
    t: 6,
    shade: (x, y) => ((x - wx) * nx + (y - wy) * ny) / 24 + 0.1,
  });
  P.block([...palm, arm[2], arm[1]]);
}
function two() {
  const P = Plate(5202, { vignette: false, width: W, height: H });
  const cx = 320;
  const rimY = 330;
  hand(P, 120, 210, 268, 292);
  hand(P, 540, 200, 380, 286);
  for (const [x, y, k] of [
    [300, 316, 'amla'],
    [338, 322, 'harad'],
    [262, 324, 'baheda'],
    [360, 312, 'amla'],
    [226, 318, 'harad'],
    [404, 320, 'baheda'],
  ])
    fruit(P, x, y, k);
  bark(P, 300, 300, 70, -0.3);
  bark(P, 250, 306, 58, 0.25);
  crystals(P, 30, () => [cx - 150 + P.rnd() * 300, rimY - 2 - P.rnd() * 26], 4);
  mound(P, cx, rimY + 4, 170, 40, { t: 3 });
  const v = paraat(P, cx, rimY, 200, 34, 42);
  P.line(v.back, { w: 1, t: 2 });
  // beside it: more fruit and bark, waiting
  fruit(P, 560, GROUND - 10, 'amla');
  fruit(P, 584, GROUND - 13, 'harad');
  fruit(P, 538, GROUND - 9, 'baheda');
  bark(P, 64, GROUND - 8, 80, -0.05);
  bark(P, 80, GROUND - 20, 70, 0.08);
  ground(P);
  return P.svg(STYLE);
}

/* ---------------- 3 and 4: the pots in the bhatti ---------------- */
const POTS = [150, 235, 320, 405, 490];
function pot(P, x, y, r) {
  // a round clay pot, its mouth sealed with a lump of clay
  const body = arc(x, y, r, r * 0.92);
  const neck = [
    [x - r * 0.42, y - r * 0.86],
    [x - r * 0.36, y - r * 1.08],
    [x + r * 0.36, y - r * 1.08],
    [x + r * 0.42, y - r * 0.86],
  ];
  const seal = curve([
    [x - r * 0.44, y - r * 1.06],
    [x - r * 0.3, y - r * 1.3],
    [x, y - r * 1.36],
    [x + r * 0.32, y - r * 1.28],
    [x + r * 0.44, y - r * 1.06],
  ]);
  P.line(seal, { w: 1, t: 1 });
  P.hatch([...seal, seal[0]], { angle: 100, gap: 1.8, t: 6, shade: (xx) => (xx - x) / r + 0.4 });
  P.block([...seal, seal[0]]);
  P.line(neck, { w: 1, t: 1, taper: false });
  P.shape(body, { w: 1.25, t: 1 });
  P.line(arc(x, y - r * 0.35, r * 0.93, r * 0.12, 0.2, Math.PI - 0.2), { w: 0.5, t: 4 });
  P.hatch(body, {
    angle: 75,
    gap: 2.3,
    t: 6,
    shade: (xx, yy) => (xx - x) / r + (yy - y) / (r * 1.6) + 0.15,
    over: (xx) => xx > x + r * 0.45,
  });
  P.block([...body, ...neck]);
}
/** The bhatti: a long low earthen wall in front of the pots; returns its top edge y. */
function bhatti(P, fire) {
  const top = 318;
  const wall = curve([
    [70, GROUND],
    [76, top + 10],
    [100, top],
    [320, top - 4],
    [540, top],
    [564, top + 10],
    [570, GROUND],
  ]);
  const mouth = arc(320, GROUND, 46, 34, Math.PI, Math.PI * 2, 40);
  P.line(wall, { w: 1.4, t: 1, swell: true });
  P.line(mouth, { w: 1.25, t: 1 });
  if (fire) {
    // the fire's mouth glows: short strokes inside it, the flame group draws the rest
    P.hatch([...mouth, mouth[0]], { angle: 90, gap: 3, t: 7, shade: () => 0.4 });
  }
  P.block([...mouth, mouth[0]]);
  // mud plaster: rough strokes and a few cracks
  for (let i = 0; i < 18; i++) {
    const x = 96 + P.rnd() * 450;
    const y = top + 14 + P.rnd() * 66;
    P.line(
      [
        [x, y],
        [x + 8 + P.rnd() * 14, y + (P.rnd() - 0.5) * 4],
      ],
      { w: 0.5, t: 5, amp: 0.5 },
    );
  }
  P.hatch([...wall, wall[0]], {
    angle: 12,
    gap: 2.6,
    t: 6,
    shade: (x, y) => 0.1 + Math.abs(x - 320) / 300 + (y - top) / 160,
  });
  P.block([...wall, wall[0]]);
  return top;
}
function kande(P, x, y, n) {
  // a stack of cow-dung cakes, seen edge-on: flat discs one on another
  for (let i = 0; i < n; i++) {
    const yy = y - i * 9;
    const d = arc(x + (P.rnd() - 0.5) * 4, yy, 22, 6);
    P.shape(d, { w: 1, t: 2, amp: 0.5 });
    P.hatch(d, { angle: 0, gap: 1.6, t: 6, shade: (xx, y2) => (y2 - yy) / 6 + 0.3 });
    P.block(d);
  }
}
function pots(P, fire) {
  ground(P);
  if (fire) {
    P.at('base');
    for (const [i, x] of [92, 192, 277, 362, 447, 548].entries()) kande(P, x, 318 - 2, 3 + (i % 2));
  }
  const top = bhatti(P, fire);
  for (const x of POTS) pot(P, x, top - 26, 36);
  if (!fire) {
    // one more pot, being lowered into its place: ropes up out of the frame
    pot(P, 560, 190, 30);
    for (const dx of [-16, 16])
      P.line(
        [
          [560 + dx, 154],
          [560 + dx * 0.4, 40],
        ],
        { w: 0.75, t: 2, taper: false },
      );
  }
}
function three() {
  const P = Plate(5303, { vignette: false, width: W, height: H });
  pots(P, false);
  return P.svg(STYLE);
}
/** The flames: teardrop strokes between the pots, rising from the cakes. */
/**
 * The flames: teardrop strokes between the pots, rising from the cakes, each its own group
 * (data-s="flame-<n>"), in the order they catch: the section shows more of them as the hours
 * go on, and makes them taller.
 */
const FLAMES = [
  [320, 300, 0],
  [277, 300, 1],
  [362, 300, 2],
  [236, 330, 0],
  [404, 330, 1],
  [192, 300, 2],
  [447, 300, 0],
  [298, 330, 2],
  [342, 330, 1],
  [110, 300, 1],
  [530, 300, 2],
  [150, 330, 0],
  [490, 330, 1],
  [72, 330, 2],
];
function flames(P) {
  for (const [i, [x, b, k]] of FLAMES.entries()) {
    P.at(`flame-${i}`);
    const h = 50 + ((i * 37) % 30);
    const w = 10 + k * 3;
    P.line(
      curve([
        [x - w, b],
        [x - w * 0.9, b - h * 0.4],
        [x - w * 0.2, b - h * 0.75],
        [x + w * 0.15, b - h],
        [x + w * 0.4, b - h * 0.7],
        [x + w, b - h * 0.32],
        [x + w * 0.7, b],
      ]),
      { w: 1, t: 1, amp: 0.6 },
    );
    P.line(
      curve([
        [x - w * 0.4, b - 2],
        [x - w * 0.2, b - h * 0.45],
        [x + w * 0.1, b - h * 0.62],
        [x + w * 0.35, b - h * 0.3],
      ]),
      { w: 0.5, t: 2, amp: 0.4 },
    );
  }
}
function four() {
  const P = Plate(5404, { vignette: false, width: W, height: H });
  pots(P, true);
  // the flames burn in front of what is drawn: a separate plate, not blocked by the pots
  const F = Plate(5405, { vignette: false, width: W, height: H });
  flames(F);
  const groups = F.svg('').match(/<g data-s="flame-\d+">.*?<\/g>/g) ?? [];
  const flameG = `<g data-s="flame">${groups.join('')}</g>`;
  let sparks = '<g data-sparks>';
  for (let i = 0; i < 18; i++) {
    const x = 110 + ((i * 97) % 420);
    const y = 236 - ((i * 53) % 64);
    sparks += `<circle cx="${x}" cy="${y}" r="${(1 + (i % 3) * 0.4).toFixed(1)}" fill="#a8823f" stroke="none" style="--i:${i}"/>`;
  }
  sparks += '</g>';
  // soot: the pots darken as they burn (the section sets the group's opacity), above the wall
  const soot =
    '<clipPath id="fire-soot"><rect x="0" y="0" width="640" height="318"/></clipPath>' +
    `<g data-soot clip-path="url(#fire-soot)" fill="#3a2e3a" stroke="none">${POTS.map(
      (x) =>
        `<ellipse cx="${x}" cy="292" rx="34" ry="32"/><ellipse cx="${x}" cy="252" rx="13" ry="7"/>`,
    ).join('')}</g>`;
  return P.svg(STYLE)
    .replace(/(<style>.*?<\/style>)/, `$1${soot}`)
    .replace('</svg>', `${flameG}${sparks}</svg>`);
}

/* ---------------- 5: broken by hand ---------------- */
function lump(cx, cy, r, rnd, n = 7) {
  return Array.from({ length: n }, (_, k) => {
    const a = (k / n) * Math.PI * 2 + rnd() * 0.4;
    const rr = r * (0.7 + rnd() * 0.45);
    return [cx + rr * Math.cos(a), cy + rr * Math.sin(a) * 0.72];
  });
}
const d = (pts) => 'M' + pts.map((q) => q.map((v) => v.toFixed(1)).join(' ')).join('L') + 'Z';
function five() {
  const P = Plate(5505, { vignette: false, width: W, height: H });
  const fills = { lumps: [], grains: [] };
  // the stone, raised over the middle lump
  const stone = curve(
    [
      [280, 180],
      [300, 160],
      [346, 158],
      [368, 176],
      [360, 202],
      [318, 210],
      [284, 202],
    ],
    true,
  );
  P.shape(stone, { w: 1.25, t: 1 });
  P.hatch(stone, { angle: 35, gap: 2, t: 6, shade: (x, y) => (x - 300) / 70 + (y - 170) / 40 });
  P.block(stone);
  // the lumps: glassy, faceted, one cracked open
  for (const [cx, cy, r, crack] of [
    [320, 312, 44, true],
    [214, 330, 34, false],
    [404, 334, 30, false],
    [262, 350, 20, false],
  ]) {
    const pts = lump(cx, cy, r, P.rnd);
    fills.lumps.push(pts);
    P.line([...pts, pts[0]], { w: 1.25, t: 1, taper: false, amp: 0.1 });
    // facets: lines from a bright point to the corners
    const hi = [cx - r * 0.25, cy - r * 0.2];
    for (const q of pts.filter((_, k) => k % 2 === 0))
      P.line([hi, R(hi, q, 0.85)], { w: 0.5, t: 4, taper: false, amp: 0.1 });
    if (crack)
      P.line(
        [
          [cx - 6, cy - r * 0.72],
          [cx + 2, cy - 10],
          [cx - 4, cy + 4],
          [cx + 6, cy + r * 0.6],
        ],
        { w: 1, t: 3, taper: false, amp: 0.2 },
      );
    P.block([...pts, pts[0]]);
  }
  // the ground grains: a small heap of them, right
  for (let i = 0; i < 70; i++) {
    const u = P.rnd();
    const v = P.rnd();
    const x = 470 + (u - 0.5) * 120 * (1 - v * 0.6);
    const y = 372 - v * 30 - Math.abs(u - 0.5) * -10;
    const g = lump(x, y, 3 + P.rnd() * 2, P.rnd, 5);
    fills.grains.push(g);
  }
  P.line(
    curve([
      [404, 378],
      [440, 352],
      [470, 340],
      [506, 352],
      [540, 378],
    ]),
    { w: 0.75, t: 2 },
  );
  // the cloth: a square, laid on the ground, its folds
  const cloth = [
    [92, 380],
    [168, 300],
    [560, 296],
    [600, 382],
  ];
  P.line([...cloth, cloth[0]], { w: 1, t: 1, amp: 0.8 });
  for (const t of [0.3, 0.62])
    P.line([R(cloth[0], cloth[1], t), R(cloth[3], cloth[2], t)], { w: 0.5, t: 5, amp: 1.2 });
  P.hatch([...cloth, cloth[0]], { angle: 4, gap: 3.2, t: 7, shade: (x, y) => (y - 296) / 120 });
  ground(P);
  const fill = (name, list, color) =>
    `<g data-fill="${name}" fill="${color}" stroke="none">${list.map((p) => `<path d="${d(p)}"/>`).join('')}</g>`;
  const extra =
    fill('lumps', fills.lumps, '#3a2e3a') +
    fill('dark', fills.grains, '#3a2e3a') +
    fill('ground', fills.grains, '#8a6a5e');
  // the fills go under the lines
  return P.svg(STYLE).replace(/(<style>.*?<\/style>)/, `$1${extra}`);
}

/** Each frame's subject, x: the portrait crop's centre. */
const TALL = [320, 320, 320, 320, 330];

export function buildFire() {
  const frames = [one, two, three, four, five];
  frames.forEach((f, i) => {
    // cropped to the drawing (the plates leave the top empty): 16:9
    const svg = f().replace(/viewBox="[^"]*"/, 'viewBox="0 115 640 360"');
    writeFileSync(join(OUT, `fire-${i + 1}.svg`), svg);
    // phones (aspect < 0.75): a portrait crop, 4:5, round the frame's subject
    const tall = svg.replace(/viewBox="[^"]*"/, `viewBox="${TALL[i] - 148} 110 296 370"`);
    writeFileSync(join(OUT, `fire-${i + 1}-tall.svg`), tall);
    console.log(`fire-${i + 1}.svg`, (svg.length / 1024).toFixed(1) + ' KB, and -tall');
  });
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) buildFire();
