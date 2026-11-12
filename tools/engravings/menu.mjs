// The site menu's engravings (components/SiteMenu), from the same toolkit and gold-line style
// as the Journey panorama. Called by build.mjs (npm run engravings), after the panorama.
//
//   public/engravings/menu-{jar,roots,harvest,bowl}.svg   the live previews, one per link
//   components/SiteMenu/miniJar.ts                       the product rows' small jar (cap apart)
//
// Every path keeps its data-t (the order it was cut in: outlines low, hatching high), so the
// menu can draw each plate the way it was engraved, hatching last.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Plate, curve, here, lerp, rect } from './engrave.mjs';
import { readGlb } from './jar3d.mjs';

const OUT = join(here, '../../public/engravings');
const MINI = join(here, '../../components/SiteMenu/miniJar.ts');
const ATTRS =
  'xmlns="http://www.w3.org/2000/svg" fill="none" stroke="#a8823f" stroke-linecap="round" stroke-linejoin="round"';
const body = (svg) =>
  svg
    .replace(/^<svg[^>]*>|<\/svg>$/g, '')
    .replace(/<style>.*?<\/style>/, '')
    .replace(/ data-m="\d+"/g, '');
/** One flat layer: every paper shape first (behind all the lines), then the lines. */
const flat = (inner) => {
  const paths = inner.replace(/<\/?g[^>]*>/g, '').match(/<path[^>]*\/>/g) ?? [];
  const paper = paths.filter((p) => p.includes('class="p"'));
  return [...paper, ...paths.filter((p) => !p.includes('class="p"'))].join('');
};
const wrap = (box, inner) => `<svg ${ATTRS} viewBox="${box.join(' ')}">${inner}</svg>`;

/** An ellipse's points (centre, radii), from angle a0 to a1 (0 = right, π/2 = front). */
const arc = (cx, cy, rx, ry, a0 = 0, a1 = Math.PI * 2, n = 72) =>
  Array.from({ length: n + 1 }, (_, i) => {
    const a = lerp(a0, a1, i / n);
    return [cx + rx * Math.cos(a), cy + ry * Math.sin(a)];
  });

/* ---------------- the jar, front view (from the 3D model's own proportions) ---------------- */
function jarDims() {
  const g = readGlb();
  const ys = (n) => g.positions(n).map((q) => q[1]);
  const r = (n, y0, y1) =>
    Math.max(
      ...g
        .positions(n)
        .filter(([, y]) => y >= y0 && y <= y1)
        .map(([x, , z]) => Math.hypot(x, z)),
    );
  const lid0 = Math.min(...ys('Lid'));
  const lid1 = Math.max(...ys('Lid_rim'));
  return {
    lid0,
    lid1,
    label0: Math.min(...ys('Label')),
    label1: Math.max(...ys('Label')),
    rBody: r('Body', 0.006, 0.09),
    rLid: r('Lid', lid0, lid1),
    shoulder: 0.0985,
  };
}

/**
 * The jar, standing at (cx, base), `h` units tall, seen a little from above. `detail` false: the
 * outlines only (the product rows' 40px jar). The cap is its own group (data-s="cap").
 */
function jar(P, cx, base, h, { detail = true, ground = true } = {}) {
  const D = jarDims();
  const k = h / D.lid1;
  const e = 0.13; // how far above: an ellipse's height per unit of its width
  const y = (m) => base - m * k;
  const rb = D.rBody * k;
  const rl = D.rLid * k;
  const front = (m, r) => arc(cx, y(m), r, r * e, 0, Math.PI);
  const w = detail ? 1 : 1.25;

  // the cap first: it stands in front of the jar's back rim
  P.at('cap');
  const capTop = arc(cx, y(D.lid1), rl, rl * e);
  const cap = [
    ...arc(cx, y(D.lid1), rl, rl * e, Math.PI, Math.PI * 2, 36),
    ...arc(cx, y(D.lid0), rl, rl * e, 0, Math.PI, 36),
  ];
  P.line(capTop, { w, t: 2, amp: 0.15, taper: 'swell', swell: true });
  P.line(
    [
      [cx - rl, y(D.lid1)],
      [cx - rl, y(D.lid0)],
    ],
    { w, t: 2, amp: 0.1, taper: false },
  );
  P.line(
    [
      [cx + rl, y(D.lid1)],
      [cx + rl, y(D.lid0)],
    ],
    { w: w * 1.25, t: 2, amp: 0.1, taper: false },
  );
  P.line(front(D.lid0, rl), { w: w * 1.25, t: 2, amp: 0.15, taper: false });
  if (detail) {
    // the knurled edge: fine upright ribs, closer together as the cap turns away
    for (let i = 1; i < 34; i++) {
      const a = Math.PI - (i / 34) * Math.PI;
      const x = cx + rl * Math.cos(a);
      const yy = rl * e * Math.sin(a);
      P.line(
        [
          [x, y(D.lid1) + yy + 2.4],
          [x, y(D.lid0) + yy - 2.4],
        ],
        { w: 0.5, t: 4, amp: 0, taper: false },
      );
    }
    P.line(front(D.lid1 - 0.0024, rl), { w: 0.5, t: 3, amp: 0.1, taper: false });
    // the cap's top: a few level strokes in its shadow half
    P.hatch(capTop, { angle: 0, gap: 3.2, t: 6, shade: (x) => (x - cx) / rl + 0.2 });
  }
  P.block(cap);
  P.block(capTop);
  // paper behind the lines: what stands behind the jar (the menu's sun) stops at its outline
  if (detail) {
    P.paper(cap);
    P.paper(capTop);
  }

  P.at('body');
  // the body: straight walls from the shoulder, rounding under at the foot
  const foot = y(0.006);
  const outline = [
    [cx - rb, y(D.shoulder)],
    [cx - rb, foot],
    ...arc(cx, foot, rb, rb * e, Math.PI, 0, 36).map(([x, yy], i, a) => {
      // the rounded foot pulls in a touch at the very bottom
      const t = Math.sin((i / (a.length - 1)) * Math.PI);
      return [x + (cx - x) * 0.06 * t, yy + 4 * t];
    }),
    [cx + rb, y(D.shoulder)],
  ];
  P.line(outline.slice(0, 2), { w, t: 2, amp: 0.12, taper: false });
  P.line(outline.slice(1, -1), { w: w * 1.25, t: 2, amp: 0.15, taper: false });
  P.line(outline.slice(-2), { w: w * 1.4, t: 2, amp: 0.12, taper: false });
  // the neck under the cap, and the shoulder
  P.line(front(D.shoulder, rb), { w, t: 2, amp: 0.12, taper: false });
  P.line(
    [
      [cx - rb + 2, y(D.shoulder)],
      [cx - rb + 2, y(D.lid0) + 2],
    ],
    { w: 0.75, t: 2, amp: 0, taper: false },
  );
  P.line(
    [
      [cx + rb - 2, y(D.shoulder)],
      [cx + rb - 2, y(D.lid0) + 2],
    ],
    { w: 0.75, t: 2, amp: 0, taper: false },
  );
  // the label: its two edges
  P.line(front(D.label1, rb + 0.6), { w, t: 3, amp: 0.1, taper: false });
  P.line(front(D.label0, rb + 0.6), { w, t: 3, amp: 0.1, taper: false });
  if (!detail) return;

  // the label's cartouche: a fine double ruled frame and three lines of "lettering"
  const lm = (D.label0 + D.label1) / 2;
  const lw = rb * 0.62;
  const lh = (D.label1 - D.label0) * k * 0.62;
  const ly = y(lm) + rb * e * 0.95;
  const frame = rect(cx - lw, ly - lh / 2, cx + lw, ly + lh / 2);
  P.line(frame, { w: 0.5, t: 3, amp: 0.05, taper: false });
  P.line(rect(cx - lw + 4, ly - lh / 2 + 4, cx + lw - 4, ly + lh / 2 - 4), {
    w: 0.5,
    t: 3,
    amp: 0.05,
    taper: false,
  });
  P.line(
    [
      [cx - lw * 0.5, ly - lh * 0.12],
      [cx + lw * 0.5, ly - lh * 0.12],
    ],
    { w: 1.4, t: 4, amp: 0.2, taper: 'ends' },
  );
  P.line(
    [
      [cx - lw * 0.62, ly + lh * 0.1],
      [cx + lw * 0.62, ly + lh * 0.1],
    ],
    { w: 0.5, t: 4, amp: 0.2 },
  );
  P.line(
    [
      [cx - lw * 0.4, ly + lh * 0.24],
      [cx + lw * 0.4, ly + lh * 0.24],
    ],
    { w: 0.5, t: 4, amp: 0.2 },
  );
  P.block(frame);

  // the black salt through the clear glass: close cross-hatching, lighter towards the light
  // (upper left), with the glass's upright highlight left bare
  const glass = (y0, y1) => [
    [cx - rb + 3, y(y1)],
    [cx + rb - 3, y(y1)],
    ...arc(cx, y(y0), rb - 3, (rb - 3) * e, 0, Math.PI, 36),
  ];
  const lit = (x) => {
    const u = (x - cx) / rb; // -1 left .. 1 right
    if (u > -0.62 && u < -0.44) return 0; // the highlight
    return 0.42 + 0.5 * u;
  };
  for (const [y0, y1] of [
    [0.008, D.label0 - 0.002],
    [D.label1 + 0.002, D.shoulder - 0.006],
  ]) {
    const g = glass(y0, y1);
    P.hatch(g, { angle: 90, gap: 2.2, t: 6, shade: (x) => lit(x) + 0.35 });
    P.hatch(g, { angle: 28, gap: 2.6, t: 7, shade: (x) => lit(x) });
  }
  // the label's own shadow side
  P.hatch(
    [
      [cx + rb * 0.55, y(D.label1)],
      [cx + rb, y(D.label1)],
      [cx + rb, y(D.label0)],
      [cx + rb * 0.55, y(D.label0)],
    ],
    { angle: 90, gap: 2.8, t: 7, shade: (x) => (x - cx - rb * 0.55) / (rb * 0.45) },
  );
  P.block(outline.concat([outline[0]]));
  P.paper([[cx - rb, y(D.lid0)], ...outline.slice(1, -1), [cx + rb, y(D.lid0)]]);

  if (!ground) return;
  // the ground: a cast shadow to the right, level strokes giving out
  P.at('ground');
  const sh = arc(cx + rb * 0.55, base + 4, rb * 1.5, rb * e * 1.4, 0, Math.PI * 2);
  P.hatch(sh, { angle: 0, gap: 2.4, t: 8, shade: (x) => (x - cx + rb * 0.4) / (rb * 1.6) });
  for (let i = 0; i < 6; i++) {
    const yy = base + 10 + i * 7;
    P.line(
      [
        [cx - rb * 1.9 + i * 14, yy],
        [cx + rb * 2.4 - i * 10, yy],
      ],
      { w: 0.5, t: 8, amp: 0.4 },
    );
  }
}

function buildJar() {
  const P = Plate(701, { vignette: false, width: 480 });
  jar(P, 236, 352, 296);
  return wrap([0, 0, 480, 400], flat(body(P.svg())));
}

function buildMini() {
  const P = Plate(702, { vignette: false, width: 480 });
  jar(P, 60, 96, 84, { detail: false, ground: false });
  const svg = body(P.svg());
  const group = (s) => svg.match(new RegExp(`<g data-s="${s}">(.*?)</g>`))?.[1] ?? '';
  return { box: [8, 2, 104, 100], cap: group('cap'), body: group('body') };
}

/* ---------------- Recipes: a shallow bowl of salt, a wooden spoon resting on it ---------------- */
function buildBowl() {
  const P = Plate(703, { vignette: false, width: 480 });
  const cx = 230;
  const ry = 38;
  const rx = 168;
  const rimY = 236;

  // the spoon: its bowl dipped in the salt, the handle resting on the rim, up to the right
  P.at('spoon');
  const ang = (-17 * Math.PI) / 180;
  const R = ([u, v]) => [
    196 + u * Math.cos(ang) - v * Math.sin(ang),
    214 + u * Math.sin(ang) + v * Math.cos(ang),
  ];
  const spoonBowl = curve(
    [
      [-38, 0],
      [-30, -14],
      [-6, -19],
      [22, -14],
      [34, -5],
      [36, 4],
      [22, 13],
      [-4, 17],
      [-28, 12],
    ].map(R),
    true,
  );
  const handle = [
    [34, -4],
    [70, -3.2],
    [150, -4.4],
    [228, -5.6],
    [242, -4.2],
    [246, 0],
    [242, 4.2],
    [228, 5.4],
    [150, 4.2],
    [70, 3],
    [34, 4],
  ].map(R);
  P.shape(
    handle.map((q) => q),
    { w: 1, t: 2, amp: 0.1 },
  );
  // the grain, along the handle
  for (const v of [-2.2, 0, 2.2])
    P.line(
      [
        [70, v * 0.9],
        [150, v * 1.1],
        [222, v * 1.25],
      ].map(R),
      { w: 0.5, t: 5, amp: 0.25 },
    );
  P.hatch(handle, {
    angle: -17 + 90,
    gap: 2.4,
    t: 6,
    shade: (x, yy) => (yy - R([0, 0])[1] - (x - 196) * Math.tan(ang)) / 5,
  });
  P.block(handle);
  P.paper(handle);
  P.line(spoonBowl, { w: 1, t: 2, amp: 0.12, taper: 'swell', swell: true });
  // the salt heaped in the spoon
  const inSpoon = curve(
    [
      [-28, 2],
      [-18, -8],
      [0, -11],
      [18, -7],
      [26, 2],
      [8, 9],
      [-14, 8],
    ].map(R),
    true,
  );
  P.line(inSpoon, { w: 0.75, t: 3, amp: 0.3 });
  P.hatch(inSpoon, { angle: 40, gap: 2.2, t: 7, shade: (x) => (x - 186) / 40 + 0.4 });
  P.hatch(spoonBowl, { angle: -17, gap: 2.6, t: 7, shade: (x, yy) => (yy - 214) / 14 + 0.5 });
  P.block(spoonBowl);
  P.paper(spoonBowl);

  // the salt mound, rising above the rim
  P.at('salt');
  const mound = curve(
    [
      [cx - rx + 18, rimY + 2],
      [cx - 112, rimY - 30],
      [cx - 52, rimY - 60],
      [cx + 6, rimY - 74],
      [cx + 70, rimY - 58],
      [cx + 126, rimY - 26],
      [cx + rx - 16, rimY + 4],
      [cx + 80, rimY + ry - 8],
      [cx - 80, rimY + ry - 8],
    ],
    true,
  );
  P.line(mound.slice(0, Math.round(mound.length * 0.62)), { w: 0.75, t: 3, amp: 0.45 });
  // crystals: short broken strokes, closer in the shadow half
  P.hatch(mound, {
    angle: 12,
    gap: 2.4,
    t: 6,
    max: 7,
    jitter: 0.6,
    shade: (x) => (x - cx) / rx + 0.55,
  });
  P.hatch(mound, {
    angle: -30,
    gap: 3.2,
    t: 7,
    max: 5,
    jitter: 0.6,
    shade: (x) => (x - cx) / rx + 0.1,
  });
  P.block(mound);
  P.paper(mound);

  // the bowl: rim, wall and foot (shallow), shaded on the right
  P.at('bowl');
  const rim = arc(cx, rimY, rx, ry);
  P.line(rim, { w: 1, t: 2, amp: 0.15, taper: 'swell', swell: true });
  P.line(arc(cx, rimY + 3, rx - 6, ry - 3, 0.05, Math.PI - 0.05), { w: 0.5, t: 3, amp: 0.1 });
  const wall = [
    [cx - rx, rimY],
    [cx - rx + 26, rimY + 50],
    [cx - 72, rimY + 78],
    [cx, rimY + 84],
    [cx + 72, rimY + 78],
    [cx + rx - 26, rimY + 50],
    [cx + rx, rimY],
  ];
  const wallPts = curve(wall);
  P.line(wallPts, { w: 1.25, t: 2, amp: 0.15, taper: false });
  P.line(arc(cx, rimY + 80, 74, 11, 0.15, Math.PI - 0.15), { w: 1, t: 3, amp: 0.1 });
  const wallPoly = [...wallPts, ...arc(cx, rimY, rx, ry, 0, Math.PI, 48).reverse()];
  P.hatch(wallPoly, { angle: 90, gap: 2.4, t: 6, shade: (x) => (x - cx) / rx + 0.35 });
  P.hatch(wallPoly, { angle: 24, gap: 3, t: 7, shade: (x) => (x - cx) / rx - 0.2 });
  P.block(wallPoly);
  P.paper(wallPoly);
  P.paper(rim);

  // the table: a cast shadow to the right, a few level strokes
  P.at('ground');
  P.hatch(arc(cx + 50, rimY + 86, 170, 22), {
    angle: 0,
    gap: 2.4,
    t: 8,
    shade: (x) => (x - cx + 20) / 180,
  });
  for (let i = 0; i < 5; i++) {
    const yy = rimY + 98 + i * 8;
    P.line(
      [
        [cx - 200 + i * 18, yy],
        [cx + 230 - i * 14, yy],
      ],
      { w: 0.5, t: 8, amp: 0.4 },
    );
  }
  return wrap([0, 110, 480, 360], flat(body(P.svg())));
}

/* ---------------- crops of the panorama: Brine at dawn, the Harvest figure ---------------- */
const TOKEN = /[Mlz]|-?(?:\d*\.\d+|\d+)/g;

/** The subpaths of one d (each starts with an absolute M), kept if they touch the window. */
function cropD(d, [x0, y0, x1, y1]) {
  const subs = d.split(/(?=M)/);
  return subs
    .filter((s) => {
      const t = s.match(TOKEN) ?? [];
      let x = 0;
      let y = 0;
      let i = 0;
      let cmd = '';
      while (i < t.length) {
        const k = t[i];
        if (k === 'M' || k === 'l' || k === 'z') {
          cmd = k;
          i++;
          continue;
        }
        const a = +k;
        const b = +t[i + 1];
        i += 2;
        if (cmd === 'M') {
          x = a;
          y = b;
          cmd = 'l';
        } else {
          x += a;
          y += b;
        }
        if (x >= x0 && x <= x1 && y >= y0 && y <= y1) return true;
      }
      return false;
    })
    .join('');
}

/** One scene's group from a layer's SVG, cropped to a window (in that layer's units). */
function cropScene(svg, s, win) {
  const g = svg.match(new RegExp(`<g data-s="${s}">(.*?)</g>`))?.[1] ?? '';
  return g.replace(/<path([^>]*?) d="([^"]*)"([^>]*)\/>/g, (all, pre, d, post) => {
    const kept = cropD(d, win);
    return kept ? `<path${pre} d="${kept}"${post}/>` : '';
  });
}

/** A scene in near-layer units: every layer moved so its scene centre sits on the near one's. */
function composite(layers, L, s, box, extra = '') {
  const [bx, by, bw, bh] = box;
  const cN = L.near.centers[s];
  const out = ['sky', 'far', 'near']
    .map((name) => {
      const dx = cN - L[name].centers[s];
      const win = [bx - dx - 4, by - 4, bx + bw - dx + 4, by + bh + 4];
      const inner = cropScene(layers[name], s, win);
      return dx ? `<g transform="translate(${+dx.toFixed(1)} 0)">${inner}</g>` : inner;
    })
    .join('');
  return wrap(box, out + extra);
}

export function buildMenu({ layers, L, rake }) {
  const files = {
    jar: buildJar(),
    bowl: buildBowl(),
    // 01 at dawn: the sluice, its channel and the first pans
    roots: composite(layers, L, 0, [L.near.centers[0] - 300, 140, 520, 372]),
    // 03 at midday: the figure drawing the rake, its mound, in near-layer units
    harvest: composite(layers, L, 2, [2300, 150, 470, 362], rake.html),
  };
  for (const [name, svg] of Object.entries(files)) {
    writeFileSync(join(OUT, `menu-${name}.svg`), svg);
    console.log(`menu-${name}.svg`, (svg.length / 1024).toFixed(1) + ' KB');
  }
  const mini = buildMini();
  writeFileSync(
    MINI,
    `// Generated by tools/engravings/menu.mjs (npm run engravings). Do not edit by hand.
/** The product rows' small engraved jar: its body and its cap (lifted on hover), in one box. */
export const MINI_JAR = ${JSON.stringify(mini)} as const;
`,
  );
}
