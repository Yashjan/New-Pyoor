// "07 · Recipes" (components/Recipes): one gold-line engraving per recipe, same toolkit and style
// as the fire frames. Called by build.mjs (npm run engravings); also runs on its own:
//   node tools/engravings/recipes.mjs
//
//   public/engravings/recipe-{slug}.svg   400 × 500, every stroke with its data-t (draw order)
//   public/engravings/recipe-{slug}.png   1200 × 1500 on ivory, for Recipe JSON-LD
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import sharp from 'sharp';
import { Plate, curve, here, lerp } from './engrave.mjs';

const OUT = join(here, '../../public/engravings');
const W = 400;
const H = 500;
const GROUND = 440;
const STYLE =
  '<style>.p{fill:#f5f1e8;stroke:none}path{vector-effect:non-scaling-stroke;stroke-width:.75px}.a{stroke-width:.5px}.b{stroke-width:1px}.c{stroke-width:1.25px}.d{stroke-width:1.4px}</style>';

const arc = (cx, cy, rx, ry, a0 = 0, a1 = Math.PI * 2, n = 64) =>
  Array.from({ length: n + 1 }, (_, i) => {
    const a = lerp(a0, a1, i / n);
    return [cx + rx * Math.cos(a), cy + ry * Math.sin(a)];
  });

function ground(P) {
  P.line(
    [
      [30, GROUND],
      [370, GROUND + 1],
    ],
    { w: 1, t: 1, amp: 0.4 },
  );
  for (let i = 0; i < 7; i++)
    P.ripple(60 + i * 8, 340 - i * 8, GROUND + 8 + i * 7, { t: 8, seg: 20 - i });
}

/** A leaf from base to tip, its midrib and a few veins. */
function leaf(P, [bx, by], [tx, ty], wid, t = 3) {
  const dx = tx - bx;
  const dy = ty - by;
  const L = Math.hypot(dx, dy);
  const nx = -dy / L;
  const ny = dx / L;
  const at = (s, o) => [bx + dx * s + nx * o * wid, by + dy * s + ny * o * wid];
  const pts = [at(0, 0), at(0.25, 0.8), at(0.6, 0.9), at(1, 0), at(0.6, -0.9), at(0.25, -0.8)];
  const outline = P.shape(pts, { w: 0.75, t });
  P.line(curve([at(0, 0), at(0.5, 0.05), at(0.95, 0)]), { w: 0.5, t: t + 1, taper: false });
  for (const s of [0.3, 0.5, 0.7]) {
    P.line([at(s, 0), at(s + 0.12, 0.6)], { w: 0.5, t: t + 2, taper: false });
    P.line([at(s, 0), at(s + 0.12, -0.6)], { w: 0.5, t: t + 2, taper: false });
  }
  P.hatch(outline, {
    angle: 30,
    gap: 2.6,
    t: t + 3,
    shade: (x, y) => ((x - bx) * nx + (y - by) * ny > 0 ? 0.9 : 0),
  });
  P.block(outline);
}

/** A citrus slice seen at an angle: rind, segments. */
function slice(P, cx, cy, r, ry = r, t = 2) {
  P.line(arc(cx, cy, r, ry), { w: 1, t });
  P.line(arc(cx, cy, r * 0.82, ry * 0.82), { w: 0.5, t: t + 1, taper: false });
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    P.line(
      [
        [cx, cy],
        [cx + Math.cos(a) * r * 0.78, cy + Math.sin(a) * ry * 0.78],
      ],
      { w: 0.5, t: t + 2, taper: false },
    );
  }
  P.block(arc(cx, cy, r + 1, ry + 1));
}

/* ---------------- nimbu pani: a tall glass, lemon slices, mint ---------------- */
function glass() {
  const P = Plate(7101, { vignette: false, width: W, height: H });
  const cx = 200;
  const top = 120;
  const bot = 424;
  // the mint above the rim, and a slice on it: in front of everything
  leaf(P, [190, top + 4], [158, 58], 13, 2);
  leaf(P, [200, top + 2], [214, 44], 12, 2);
  leaf(P, [208, top + 4], [246, 66], 11, 2);
  slice(P, 262, top - 4, 34, 32, 2);
  // the glass
  const rim = arc(cx, top, 78, 13);
  P.line(rim, { w: 1.25, t: 1 });
  const left = curve([
    [cx - 78, top],
    [cx - 70, (top + bot) / 2],
    [cx - 62, bot],
  ]);
  const right = curve([
    [cx + 78, top],
    [cx + 70, (top + bot) / 2],
    [cx + 62, bot],
  ]);
  P.line(left, { w: 1, t: 1 });
  P.line(right, { w: 1.4, t: 1 });
  P.line(arc(cx, bot, 62, 10, 0, Math.PI), { w: 1.25, t: 1 });
  P.line(arc(cx, bot - 10, 58, 9, 0, Math.PI), { w: 0.5, t: 3 });
  // inside: the drink's surface, slices, ice, bubbles
  const surf = top + 34;
  P.line(arc(cx, surf, 74, 11), { w: 0.75, t: 2 });
  slice(P, 172, 250, 30, 30, 3);
  slice(P, 228, 330, 28, 27, 3);
  for (const [x, y, s] of [
    [230, 196, 22],
    [160, 330, 20],
    [196, 380, 18],
  ]) {
    const q = [
      [x - s, y - s * 0.3],
      [x + s * 0.4, y - s],
      [x + s, y + s * 0.2],
      [x - s * 0.3, y + s],
      [x - s, y - s * 0.3],
    ];
    P.line(q, { w: 0.5, t: 4, amp: 0.1, taper: false });
  }
  for (let i = 0; i < 24; i++) {
    const x = cx - 55 + P.rnd() * 110;
    const y = surf + 20 + P.rnd() * 240;
    P.line(arc(x, y, 1.6, 1.6, 0, Math.PI * 2, 10), { w: 0.5, t: 6, taper: false, amp: 0 });
  }
  // the glass's light: fine vertical lines down the shaded right side
  const body = [...left, ...arc(cx, bot, 62, 10, Math.PI, 0), ...right.slice().reverse()];
  P.hatch(body, { angle: 90, gap: 2.4, t: 7, shade: (x) => (x - cx) / 70 - 0.35 });
  ground(P);
  return P.svg(STYLE);
}

/* ---------------- fruit chaat: a bowl of cut fruit with a spoon ---------------- */
function bowl() {
  const P = Plate(7202, { vignette: false, width: W, height: H });
  const cx = 200;
  const rimY = 300;
  // the spoon, leaning on the rim: its bowl inside, the handle out to the right
  const spoon = arc(254, 262, 18, 11);
  P.shape(spoon, { w: 1, t: 2 });
  P.block(spoon);
  P.line(
    curve([
      [268, 256],
      [310, 220],
      [352, 178],
    ]),
    { w: 1.25, t: 2 },
  );
  P.line(
    curve([
      [270, 262],
      [312, 226],
      [354, 184],
    ]),
    { w: 0.75, t: 2 },
  );
  // mint on top
  leaf(P, [190, 236], [160, 200], 11, 2);
  leaf(P, [196, 234], [222, 196], 10, 2);
  // the fruit: banana coins, pomegranate seeds, cubes, heaped above the rim
  for (const [x, y, r] of [
    [150, 268, 22],
    [236, 286, 20],
    [104, 292, 18],
    [196, 292, 19],
    [286, 296, 16],
  ]) {
    P.line(arc(x, y, r, r * 0.7), { w: 1, t: 3 });
    P.line(arc(x, y, r * 0.35, r * 0.25), { w: 0.5, t: 4, taper: false });
    P.block(arc(x, y, r + 1, r * 0.7 + 1));
  }
  for (let i = 0; i < 26; i++) {
    const x = 80 + P.rnd() * 240;
    const y = 250 + P.rnd() * 50;
    const s = arc(x, y, 5, 4, 0, Math.PI * 2, 14);
    P.line(s, { w: 0.75, t: 3, taper: false, amp: 0 });
    P.block(s);
  }
  for (let i = 0; i < 14; i++) {
    const x = 70 + P.rnd() * 250;
    const y = 240 + P.rnd() * 56;
    const s = 14 + P.rnd() * 8;
    const q = [
      [x, y - s * 0.6],
      [x + s, y - s * 0.2],
      [x + s * 0.8, y + s * 0.6],
      [x - s * 0.2, y + s * 0.3],
    ];
    P.line([...q, q[0]], { w: 0.75, t: 3, amp: 0.1, taper: false });
    P.line([q[0], [x + s * 0.1, y + s * 0.05], q[3]], { w: 0.5, t: 4, taper: false });
    P.hatch([...q, q[0]], { angle: 60, gap: 2.4, t: 6, shade: (px) => (px - x) / s });
    P.block([...q, q[0]]);
  }
  // the bowl
  const front = arc(cx, rimY, 150, 32, 0, Math.PI);
  P.line(front, { w: 1.25, t: 1, swell: true });
  P.line(arc(cx, rimY, 150, 32, Math.PI, Math.PI * 2), { w: 1, t: 1 });
  const body = [
    ...front,
    ...curve([
      [cx - 150, rimY],
      [cx - 130, rimY + 70],
      [cx - 50, rimY + 112],
      [cx + 50, rimY + 112],
      [cx + 130, rimY + 70],
      [cx + 150, rimY],
    ]).reverse(),
  ];
  P.shape(body.slice(front.length), { w: 1, t: 1 });
  P.line(arc(cx, rimY + 116, 54, 9, 0, Math.PI), { w: 1, t: 2 });
  P.hatch(body, {
    angle: 10,
    gap: 2.2,
    t: 6,
    shade: (x, y) => 0.1 + ((x - cx) / 150) * 0.8 + ((y - rimY) / 110) * 0.4,
  });
  ground(P);
  return P.svg(STYLE);
}

/* ---------------- masala chaas: a clay kulhad, a sprig of coriander ---------------- */
function kulhad() {
  const P = Plate(7303, { vignette: false, width: W, height: H });
  const cx = 186;
  const top = 214;
  const bot = 428;
  // the coriander sprig resting across the rim
  const stem = curve([
    [214, top + 4],
    [262, 186],
    [312, 150],
  ]);
  P.line(stem, { w: 0.75, t: 2 });
  for (const [s, d, k] of [
    [0.3, 1, 18],
    [0.5, -1, 20],
    [0.7, 1, 17],
    [0.92, -1, 16],
    [0.85, 1, 14],
  ]) {
    const [x, y] = stem[Math.floor(s * (stem.length - 1))];
    const c = [x + d * 16, y - 22];
    const lobes = [0, 1, 2].map((j) => {
      const a = -Math.PI / 2 + (j - 1) * 0.9;
      return [c[0] + Math.cos(a) * k, c[1] + Math.sin(a) * k];
    });
    const out = curve(
      [
        [x, y],
        lobes[0],
        [c[0] - k * 0.2, c[1] - k * 0.5],
        lobes[1],
        [c[0] + k * 0.2, c[1] - k * 0.5],
        lobes[2],
        [x, y],
      ],
      true,
    );
    P.line(out, { w: 0.5, t: 2, taper: false });
    P.line([[x, y], c], { w: 0.5, t: 4, taper: false });
    P.block(out);
  }
  // the kulhad: wide at the mouth, tapering to a small foot
  const rim = arc(cx, top, 100, 17);
  P.line(rim, { w: 1.25, t: 1 });
  P.line(arc(cx, top + 2, 92, 14, 0, Math.PI), { w: 0.5, t: 3 });
  // the chaas inside: its surface, a little froth and cumin
  P.line(arc(cx, top + 6, 88, 12, Math.PI, Math.PI * 2), { w: 0.5, t: 3 });
  for (let i = 0; i < 20; i++) {
    const a = P.rnd() * Math.PI * 2;
    const r = Math.sqrt(P.rnd());
    const x = cx + Math.cos(a) * 76 * r;
    const y = top + 4 + Math.sin(a) * 9 * r;
    P.line(
      [
        [x, y],
        [x + 1.8, y + 0.4],
      ],
      { w: 0.75, t: 5, taper: false, amp: 0 },
    );
  }
  const left = curve([
    [cx - 100, top],
    [cx - 88, top + 110],
    [cx - 56, bot],
  ]);
  const right = curve([
    [cx + 100, top],
    [cx + 88, top + 110],
    [cx + 56, bot],
  ]);
  P.line(left, { w: 1, t: 1 });
  P.line(right, { w: 1.4, t: 1 });
  P.line(arc(cx, bot, 56, 9, 0, Math.PI), { w: 1.25, t: 1 });
  // the wheel's rings
  for (const y of [top + 40, top + 44, top + 150]) {
    const f = (y - top) / (bot - top);
    const rx = lerp(98, 58, f * f * 0.6 + f * 0.4);
    P.line(arc(cx, y, rx, 14 - f * 5, 0.1, Math.PI - 0.1), { w: 0.5, t: 4 });
  }
  const body = [...left, ...arc(cx, bot, 56, 9, Math.PI, 0), ...right.slice().reverse()];
  P.hatch(body, {
    angle: 80,
    gap: 2.8,
    t: 6,
    shade: (x, y) => 0.15 + ((x - cx) / 90) * 0.9 + ((y - top) / 214) * 0.3,
  });
  P.hatch(body, { angle: 20, gap: 3.6, t: 7, shade: (x) => (x - cx) / 90 - 0.45 });
  ground(P);
  return P.svg(STYLE);
}

export const RECIPE_ART = { 'nimbu-pani': glass, 'fruit-chaat': bowl, 'masala-chaas': kulhad };

export async function buildRecipes() {
  for (const [slug, f] of Object.entries(RECIPE_ART)) {
    const svg = f();
    writeFileSync(join(OUT, `recipe-${slug}.svg`), svg);
    await sharp(Buffer.from(svg), { density: 216 })
      .resize(1200, 1500)
      .flatten({ background: '#f5f1e8' })
      .png({ compressionLevel: 9 })
      .toFile(join(OUT, `recipe-${slug}.png`));
    console.log(`recipe-${slug}.svg`, (svg.length / 1024).toFixed(1) + ' KB, and .png');
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) await buildRecipes();
