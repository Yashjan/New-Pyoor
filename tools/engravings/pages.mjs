// The standalone story pages (/our-roots, /the-journey): their chapter engravings, in the same
// toolkit and gold-line style as the rest. Called by build.mjs (npm run engravings), after the
// panorama; also runs on its own (it reads the panorama's SVGs and constants from disk):
//   node tools/engravings/pages.mjs
//
//   public/engravings/scene-{1..4}.svg        the Journey panorama's scenes 01–04, each one plate
//   public/engravings/page-{name}.svg         the chapters' own plates (640 × 400)
//   public/engravings/check-{name}.svg        the batch checks' small icons (120 × 120)
//
// Every path keeps its data-t, so the page draws each plate the way it was cut.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Plate, curve, here, lerp, mound, rect } from './engrave.mjs';
import { composite } from './menu.mjs';

const OUT = join(here, '../../public/engravings');
const STYLE =
  '<style>.p{fill:#f5f1e8;stroke:none}path{vector-effect:non-scaling-stroke;stroke-width:.75px}.a{stroke-width:.5px}.b{stroke-width:1px}.c{stroke-width:1.25px}.d{stroke-width:1.4px}</style>';
const W = 640;
const H = 400;

const arc = (cx, cy, rx, ry, a0 = 0, a1 = Math.PI * 2, n = 48) =>
  Array.from({ length: n + 1 }, (_, i) => {
    const a = lerp(a0, a1, i / n);
    return [cx + rx * Math.cos(a), cy + ry * Math.sin(a)];
  });
const close = (p) => [...p, p[0]];

/** The floor: one level line and a few fading strokes under it. */
function floor(P, y = 352, x0 = 30, x1 = 610) {
  P.line(
    [
      [x0, y],
      [x1, y + 1],
    ],
    { w: 1, t: 1, amp: 0.4 },
  );
  for (let i = 0; i < 5; i++)
    P.ripple(x0 + 30 + i * 14, x1 - 30 - i * 14, y + 8 + i * 7, { t: 8, seg: 24 - i * 2 });
}

/**
 * The Pyoor jar, engraved: cap (ribbed), clear body with salt, the label band. Drawn first,
 * then blocks what is drawn after it (anything behind).
 */
function jar(P, cx, base, w, h, t = 1) {
  const x0 = cx - w / 2;
  const x1 = cx + w / 2;
  const top = base - h;
  const capH = h * 0.14;
  const r = w * 0.09;
  const cap = close([
    [x0 + w * 0.03, top],
    [x1 - w * 0.03, top],
    [x1 - w * 0.03, top + capH],
    [x0 + w * 0.03, top + capH],
  ]);
  P.line(cap, { w: 1.25, t, taper: false });
  for (let x = x0 + w * 0.08; x < x1 - w * 0.05; x += w * 0.05)
    P.line(
      [
        [x, top + 3],
        [x, top + capH - 3],
      ],
      { w: 0.5, t: t + 3, taper: false, amp: 0 },
    );
  const side = [
    [x0, top + capH],
    ...arc(x0 + r, base - r, r, r, Math.PI, Math.PI / 2, 8),
    ...arc(x1 - r, base - r, r, r, Math.PI / 2, 0, 8),
    [x1, top + capH],
  ];
  P.line(side, { w: 1.25, t, swell: true });
  P.line(
    [
      [x0, top + capH],
      [x1, top + capH],
    ],
    { w: 1, t, taper: false },
  );
  // the label band, a sun and a few lines of type
  const l0 = top + h * 0.36;
  const l1 = top + h * 0.74;
  P.line(
    [
      [x0, l0],
      [x1, l0],
    ],
    { w: 0.75, t: t + 1, taper: false },
  );
  P.line(
    [
      [x0, l1],
      [x1, l1],
    ],
    { w: 0.75, t: t + 1, taper: false },
  );
  const sy = l0 + (l1 - l0) * 0.3;
  P.line(arc(cx, sy, w * 0.07, w * 0.07, Math.PI, Math.PI * 2, 16), {
    w: 0.75,
    t: t + 2,
    taper: false,
  });
  P.line(
    [
      [cx - w * 0.12, sy],
      [cx + w * 0.12, sy],
    ],
    { w: 0.5, t: t + 2, taper: false },
  );
  for (const [k, f] of [
    [0.55, 0.3],
    [0.68, 0.2],
    [0.8, 0.24],
  ]) {
    const y = l0 + (l1 - l0) * k;
    P.line(
      [
        [cx - w * f, y],
        [cx + w * f, y],
      ],
      { w: k === 0.55 ? 1 : 0.5, t: t + 2, taper: false, amp: 0 },
    );
  }
  // the salt inside, above and below the label: fine stipple
  for (const [y0, y1] of [
    [top + capH + 4, l0 - 3],
    [l1 + 3, base - 4],
  ])
    for (let i = 0; i < (y1 - y0) * w * 0.012; i++) {
      const x = x0 + 4 + P.rnd() * (w - 8);
      const y = y0 + P.rnd() * (y1 - y0);
      P.line(
        [
          [x, y],
          [x + 1.6, y + 0.4],
        ],
        { w: 0.5, t: t + 4, taper: false, amp: 0 },
      );
    }
  const body = close([...side]);
  P.hatch(body, { angle: 90, gap: 2.4, t: t + 5, shade: (x) => (x - cx) / (w / 2) - 0.25 });
  P.block(close([[x0, top], [x1, top], ...side.slice().reverse()].reverse()));
}

/** A cut crystal: a little cube in three-quarter view, its dark face hatched. */
function crystal(P, x, y, s, t = 2) {
  const q = s * 0.5;
  const top = close([
    [x, y],
    [x + s, y - q * 0.4],
    [x + s + q, y + q * 0.25],
    [x + q, y + q * 0.65],
  ]);
  const front = close([
    [x + q, y + q * 0.65],
    [x + s + q, y + q * 0.25],
    [x + s + q, y + q * 0.25 + s],
    [x + q, y + q * 0.65 + s],
  ]);
  P.line(top, { w: 0.75, t, taper: false, amp: 0.1 });
  P.line(
    [
      [x, y],
      [x, y + s],
      [x + q, y + q * 0.65 + s],
      [x + s + q, y + q * 0.25 + s],
      [x + s + q, y + q * 0.25],
    ],
    { w: 1, t, taper: false, amp: 0.1 },
  );
  P.line(
    [
      [x + q, y + q * 0.65],
      [x + q, y + q * 0.65 + s],
    ],
    { w: 0.5, t: t + 1, taper: false, amp: 0 },
  );
  P.hatch(front, { angle: 70, gap: Math.max(1.6, s / 9), t: t + 3, shade: () => 0.7 });
  P.block(
    close([
      [x, y],
      [x + s, y - q * 0.4],
      [x + s + q, y + q * 0.25],
      [x + s + q, y + q * 0.25 + s],
      [x + q, y + q * 0.65 + s],
      [x, y + s],
    ]),
  );
}

/* ---------------- our roots 02: a salt refinery machine ---------------- */
function refinery() {
  const P = Plate(8101, { vignette: false, width: W, height: H });
  const F = 352;
  // the salt falling from the drum's outlet into a heap (in front)
  for (let i = 0; i < 26; i++) {
    const x = 486 + P.rnd() * 26;
    const y = 262 + P.rnd() * 50;
    P.line(
      [
        [x, y],
        [x + 0.6, y + 4 + P.rnd() * 5],
      ],
      { w: 0.5, t: 6, taper: false, amp: 0 },
    );
  }
  mound(P, 500, F, 62, 42, { t: 3 });
  // the drum: a long cylinder on its side, banded, its end a wheel with spokes
  const dx0 = 250;
  const dx1 = 470;
  const dc = 190;
  const ry = 66;
  const rx = 20;
  P.line(arc(dx1, dc, rx, ry, -Math.PI / 2, Math.PI / 2, 32), { w: 1.4, t: 1 });
  const endL = arc(dx0, dc, rx, ry);
  P.line(endL, { w: 1.25, t: 1 });
  P.line(arc(dx0, dc, rx * 0.8, ry * 0.8), { w: 0.5, t: 3, taper: false });
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    P.line(
      [
        [dx0, dc],
        [dx0 + Math.cos(a) * rx * 0.8, dc + Math.sin(a) * ry * 0.8],
      ],
      { w: 0.5, t: 3, taper: false },
    );
  }
  P.line(arc(dx0, dc, 4, 10), { w: 1, t: 2, taper: false });
  P.block(endL);
  P.line(
    [
      [dx0, dc - ry],
      [dx1, dc - ry],
    ],
    { w: 1.25, t: 1 },
  );
  P.line(
    [
      [dx0, dc + ry],
      [dx1, dc + ry],
    ],
    { w: 1.4, t: 1 },
  );
  for (const x of [300, 310, 380, 390, 440])
    P.line(arc(x, dc, rx, ry, -Math.PI / 2, Math.PI / 2, 28), { w: 0.75, t: 3 });
  const drum = close([
    [dx0, dc - ry],
    [dx1, dc - ry],
    ...arc(dx1, dc, rx, ry, -Math.PI / 2, Math.PI / 2, 20),
    [dx0, dc + ry],
  ]);
  P.hatch(drum, { angle: 0, gap: 2.4, t: 6, shade: (x, y) => (y - dc) / ry + 0.15 });
  // the outlet chute at the far end
  P.line(
    [
      [474, 236],
      [500, 258],
      [516, 262],
    ],
    { w: 1, t: 2 },
  );
  P.line(
    [
      [476, 248],
      [494, 266],
      [508, 268],
    ],
    { w: 0.75, t: 2 },
  );
  P.block(drum);
  // the frame under it: legs and a brace
  for (const x of [270, 330, 410, 452])
    P.line(
      [
        [x, dc + ry - 4],
        [x + (x < 360 ? -14 : 14), F],
      ],
      { w: 1.25, t: 2 },
    );
  P.line(
    [
      [262, 300],
      [462, 300],
    ],
    { w: 1, t: 2 },
  );
  P.line(
    [
      [266, 330],
      [330, 262],
    ],
    { w: 0.5, t: 4 },
  );
  P.line(
    [
      [396, 262],
      [458, 330],
    ],
    { w: 0.5, t: 4 },
  );
  // the hopper over its mouth
  const hop = close([
    [200, 52],
    [292, 52],
    [266, 112],
    [236, 112],
  ]);
  P.line(hop, { w: 1.25, t: 1, taper: false });
  P.line(
    [
      [236, 112],
      [244, 132],
      [258, 132],
      [266, 112],
    ],
    { w: 1, t: 2, taper: false },
  );
  P.hatch(hop, { angle: 80, gap: 2.4, t: 6, shade: (x) => (x - 246) / 40 });
  P.block(hop);
  // the conveyor: belt from the floor up to the hopper, rollers, a little salt on it
  const a = [44, 322];
  const b = [210, 60];
  const n = [
    Math.cos(Math.atan2(b[1] - a[1], b[0] - a[0]) + Math.PI / 2),
    Math.sin(Math.atan2(b[1] - a[1], b[0] - a[0]) + Math.PI / 2),
  ];
  const off = (p, k) => [p[0] + n[0] * k, p[1] + n[1] * k];
  for (let i = 0; i < 9; i++) {
    const p = [lerp(a[0], b[0], 0.08 + i * 0.1), lerp(a[1], b[1], 0.08 + i * 0.1)];
    const m = arc(p[0], p[1] - 6, 9, 5, Math.PI, Math.PI * 2, 12);
    P.line(m, { w: 0.5, t: 4, taper: false });
  }
  P.line([off(a, -2), off(b, -2)], { w: 1.25, t: 1 });
  P.line([off(a, 12), off(b, 12)], { w: 1, t: 1 });
  P.line(arc(...off(a, 5), 9, 9), { w: 0.75, t: 2, taper: false });
  P.line(arc(...off(b, 5), 9, 9), { w: 0.75, t: 2, taper: false });
  for (const f of [0.25, 0.55, 0.8]) {
    const p = off([lerp(a[0], b[0], f), lerp(a[1], b[1], f)], 12);
    P.line([p, [p[0] + 4, F]], { w: 1, t: 2 });
  }
  // a gear and belt driving the drum
  const gc = [150, 300];
  P.line(arc(...gc, 30, 30), { w: 1, t: 2 });
  for (let k = 0; k < 16; k++) {
    const a1 = (k / 16) * Math.PI * 2;
    P.line(
      [
        [gc[0] + Math.cos(a1) * 30, gc[1] + Math.sin(a1) * 30],
        [gc[0] + Math.cos(a1) * 36, gc[1] + Math.sin(a1) * 36],
      ],
      { w: 1, t: 3, taper: false },
    );
  }
  P.line(arc(...gc, 8, 8), { w: 0.75, t: 3, taper: false });
  P.line(
    [
      [gc[0], gc[1] - 30],
      [dx0, dc - 8],
    ],
    { w: 0.75, t: 3 },
  );
  P.line(
    [
      [gc[0], gc[1] + 30],
      [dx0, dc + 8],
    ],
    { w: 0.75, t: 3 },
  );
  floor(P, F);
  return P.svg(STYLE);
}

/* ---------------- our roots 03: a jar on a workbench, a notebook, a pencil ---------------- */
function bench() {
  const P = Plate(8202, { vignette: false, width: W, height: H });
  const T = 290;
  jar(P, 430, T + 6, 112, 176, 1);
  // a small heap of salt on a brass spoon by the jar
  const spoon = arc(318, T + 8, 26, 9);
  P.line(spoon, { w: 1, t: 2 });
  P.line(
    [
      [292, T + 10],
      [232, T + 22],
    ],
    { w: 1.25, t: 2 },
  );
  mound(P, 318, T + 6, 18, 12, { t: 3 });
  P.block(spoon);
  // the open notebook: two pages in perspective, ruled, a few lines of handwriting
  const L = close([
    [60, T + 2],
    [170, T - 8],
    [196, T + 34],
    [74, T + 46],
  ]);
  const R = close([
    [170, T - 8],
    [268, T - 2],
    [286, T + 40],
    [196, T + 34],
  ]);
  for (const pg of [L, R]) P.line(pg, { w: 1, t: 1, taper: false });
  for (let i = 1; i < 7; i++) {
    const f = i / 7;
    P.line(
      [
        [lerp(60, 74, f) + 8, lerp(T + 2, T + 46, f)],
        [lerp(170, 196, f) - 6, lerp(T - 8, T + 34, f)],
      ],
      { w: 0.5, t: 4, taper: false, amp: 0.6 },
    );
    P.line(
      [
        [lerp(170, 196, f) + 6, lerp(T - 8, T + 34, f)],
        [lerp(268, 286, f) - 8, lerp(T - 2, T + 40, f)],
      ],
      { w: 0.5, t: 4, taper: false, amp: 0.6 },
    );
  }
  P.line(
    [
      [140, T + 50],
      [244, T + 4],
    ],
    { w: 1.25, t: 2 },
  );
  P.line(
    [
      [244, T + 4],
      [252, T + 1],
    ],
    { w: 0.5, t: 3 },
  );
  P.block(L);
  P.block(R);
  // the bench: top, front edge, legs, the grain
  const top = close([
    [24, T - 12],
    [616, T - 12],
    [628, T + 52],
    [12, T + 52],
  ]);
  P.line(
    [
      [24, T - 12],
      [616, T - 12],
    ],
    { w: 1, t: 1 },
  );
  P.line(
    [
      [12, T + 52],
      [628, T + 52],
    ],
    { w: 1.4, t: 1 },
  );
  P.line(
    [
      [12, T + 52],
      [12, T + 66],
      [628, T + 66],
      [628, T + 52],
    ],
    { w: 1, t: 1, taper: false },
  );
  for (let i = 0; i < 7; i++) {
    const y = T - 4 + i * 8;
    P.ripple(30, 610, y, { t: 6, seg: 60 });
  }
  P.hatch(
    close([
      [12, T + 52],
      [628, T + 52],
      [628, T + 66],
      [12, T + 66],
    ]),
    { angle: 0, gap: 2, t: 6 },
  );
  P.block(top);
  for (const x of [40, 600]) {
    P.line(
      [
        [x, T + 66],
        [x, 396],
      ],
      { w: 1.25, t: 2 },
    );
    P.line(
      [
        [x + 18, T + 66],
        [x + 18, 396],
      ],
      { w: 1, t: 2 },
    );
  }
  // a shelf of tools on the wall behind: a hammer, a spanner, a rule
  P.line(
    [
      [80, 120],
      [300, 120],
    ],
    { w: 1, t: 3 },
  );
  P.line(
    [
      [110, 120],
      [110, 40],
    ],
    { w: 1, t: 4 },
  );
  P.line(
    close([
      [96, 40],
      [128, 40],
      [128, 54],
      [96, 54],
    ]),
    { w: 0.75, t: 4, taper: false },
  );
  P.line(
    [
      [170, 120],
      [190, 50],
    ],
    { w: 1, t: 4 },
  );
  P.line(arc(192, 44, 9, 9, -2.5, 1.6, 16), { w: 0.75, t: 4 });
  P.line(
    close([
      [230, 112],
      [290, 66],
      [296, 72],
      [236, 118],
    ]),
    { w: 0.75, t: 4, taper: false },
  );
  for (let i = 0; i < 9; i++) {
    const f = i / 9;
    const x = lerp(236, 290, f);
    const y = lerp(116, 70, f);
    P.line(
      [
        [x, y],
        [x - 3, y - 4],
      ],
      { w: 0.5, t: 5, taper: false, amp: 0 },
    );
  }
  return P.svg(STYLE);
}

/* ---------------- filled, sealed, batch-numbered: jars on a line ---------------- */
function packing() {
  const P = Plate(8303, { vignette: false, width: W, height: H });
  const B = 330;
  // the stream of salt into the middle jar
  for (let i = 0; i < 40; i++) {
    const x = 314 + P.rnd() * 12;
    const y = 120 + P.rnd() * 76;
    P.line(
      [
        [x, y],
        [x, y + 4 + P.rnd() * 4],
      ],
      { w: 0.5, t: 3, taper: false, amp: 0 },
    );
  }
  // the jars: the left one sealed and stamped, the middle filling (open), the right waiting
  jar(P, 150, B, 96, 150, 1);
  // the batch stamp on the left jar's cap: a small inked rectangle with a number line
  P.line(
    close([
      [128, B - 136],
      [172, B - 136],
      [172, B - 124],
      [128, B - 124],
    ]),
    { w: 0.75, t: 6, taper: false },
  );
  for (const x of [134, 142, 150, 158, 166])
    P.line(
      [
        [x, B - 133],
        [x, B - 127],
      ],
      { w: 0.5, t: 7, taper: false, amp: 0 },
    );
  // the open jar: no cap yet, salt rising inside
  const o0 = 270;
  const o1 = 370;
  const top = B - 130;
  P.line(
    [
      [o0, top],
      ...arc(o0 + 9, B - 9, 9, 9, Math.PI, Math.PI / 2, 8),
      ...arc(o1 - 9, B - 9, 9, 9, Math.PI / 2, 0, 8),
      [o1, top],
    ],
    { w: 1.25, t: 1, swell: true },
  );
  P.line(arc(320, top, 50, 7), { w: 1, t: 1 });
  mound(P, 320, B - 40, 46, 22, { t: 3 });
  for (let i = 0; i < 160; i++) {
    const x = o0 + 4 + P.rnd() * 92;
    const y = B - 40 + P.rnd() * 36;
    P.line(
      [
        [x, y],
        [x + 1.6, y + 0.4],
      ],
      { w: 0.5, t: 4, taper: false, amp: 0 },
    );
  }
  P.block(
    close([
      [o0, top - 8],
      [o1, top - 8],
      [o1, B],
      [o0, B],
    ]),
  );
  jar(P, 500, B, 96, 150, 1);
  // the filler over the line: a hopper, its spout
  const hop = close([
    [244, 20],
    [396, 20],
    [340, 96],
    [300, 96],
  ]);
  P.line(hop, { w: 1.25, t: 1, taper: false });
  P.line(
    [
      [306, 96],
      [310, 118],
      [330, 118],
      [334, 96],
    ],
    { w: 1, t: 1, taper: false },
  );
  P.hatch(hop, { angle: 80, gap: 2.4, t: 6, shade: (x) => (x - 320) / 60 });
  P.block(hop);
  // the sealing head over the right jar
  P.line(
    close([
      [470, 60],
      [530, 60],
      [530, 110],
      [470, 110],
    ]),
    { w: 1, t: 2, taper: false },
  );
  P.line(
    [
      [500, 20],
      [500, 60],
    ],
    { w: 1.25, t: 2 },
  );
  P.line(
    [
      [480, 110],
      [480, 150],
      [520, 150],
      [520, 110],
    ],
    { w: 0.75, t: 3, taper: false },
  );
  P.hatch(
    close([
      [470, 60],
      [530, 60],
      [530, 110],
      [470, 110],
    ]),
    { angle: 90, gap: 2.4, t: 6, shade: (x) => (x - 500) / 30 },
  );
  // the conveyor under them
  P.line(
    [
      [20, B],
      [620, B],
    ],
    { w: 1.4, t: 1 },
  );
  P.line(
    [
      [20, B + 16],
      [620, B + 16],
    ],
    { w: 1, t: 1 },
  );
  for (let x = 40; x < 620; x += 40) P.line(arc(x, B + 8, 6, 6), { w: 0.5, t: 4, taper: false });
  for (const x of [60, 580])
    P.line(
      [
        [x, B + 16],
        [x, 396],
      ],
      { w: 1.25, t: 2 },
    );
  return P.svg(STYLE);
}

/* ---------------- the heaps dry in the sun ---------------- */
function heaps() {
  const P = Plate(8404, { vignette: false, width: W, height: H });
  const HZ = 170;
  // nearest first: each hides what lies behind it
  for (const [x, b, r, h] of [
    [200, 352, 130, 120],
    [470, 336, 110, 96],
    [330, 268, 76, 60],
    [80, 262, 58, 44],
    [560, 236, 46, 34],
    [420, 214, 40, 28],
    [250, 204, 32, 22],
    [130, 196, 26, 17],
    [520, 190, 22, 14],
  ])
    mound(P, x, b, r, h, { t: b > 300 ? 2 : 3 });
  // the sun, high, and the horizon
  P.line(arc(470, 70, 26, 26), { w: 0.75, t: 1, taper: false });
  for (const y of [6, 12, 18]) {
    const hh = Math.sqrt(24 * 24 - y * y);
    P.line(
      [
        [470 - hh, 70 + y],
        [470 + hh, 70 + y],
      ],
      { w: 0.5, t: 2, taper: false },
    );
  }
  P.line(
    [
      [20, HZ],
      [620, HZ + 1],
    ],
    { w: 1, t: 1, amp: 0.3 },
  );
  for (let i = 0; i < 12; i++) P.ripple(20, 620, HZ + 14 + i * 16, { t: 7, seg: 44 - i * 2 });
  return P.svg(STYLE);
}

/* ---------------- chosen and checked: a brass tray of crystals, a glass over them ---------------- */
function checking() {
  const P = Plate(8505, { vignette: false, width: W, height: H });
  const c = [384, 196];
  const R = 74;
  // the magnifier: its rim, handle, and big crystals seen through it
  const lens = arc(c[0], c[1], R, R);
  P.line(lens, { w: 1.4, t: 1 });
  P.line(arc(c[0], c[1], R - 6, R - 6), { w: 0.5, t: 2, taper: false });
  P.within((q) => Math.hypot(q[0] - c[0], q[1] - c[1]) < R - 8);
  for (const [x, y, s] of [
    [340, 170, 34],
    [392, 200, 40],
    [350, 222, 26],
    [418, 150, 24],
  ])
    crystal(P, x, y, s, 3);
  P.within(null);
  P.line(arc(c[0] - 26, c[1] - 30, 22, 14, Math.PI * 1.1, Math.PI * 1.5, 10), {
    w: 0.75,
    t: 4,
    taper: false,
  });
  P.block(lens);
  const h0 = [c[0] + R * 0.72, c[1] + R * 0.72];
  const handle = close([
    [h0[0] - 6, h0[1] + 6],
    [h0[0] + 6, h0[1] - 6],
    [h0[0] + 96, h0[1] + 78],
    [h0[0] + 84, h0[1] + 92],
  ]);
  P.line(handle, { w: 1.25, t: 1, taper: false });
  P.hatch(handle, { angle: 45, gap: 2, t: 6, shade: () => 0.7 });
  P.block(handle);
  // crystals spread on the tray
  for (let i = 0; i < 60; i++) {
    const a = P.rnd() * Math.PI * 2;
    const r = Math.sqrt(P.rnd());
    crystal(P, 300 + Math.cos(a) * 200 * r, 300 + Math.sin(a) * 34 * r, 4 + P.rnd() * 6, 4);
  }
  // the tray
  const rim = arc(300, 300, 240, 52);
  P.line(rim, { w: 1.25, t: 1 });
  P.line(arc(300, 300, 226, 46), { w: 0.5, t: 2, taper: false });
  P.line(arc(300, 312, 240, 52, 0, Math.PI), { w: 1.4, t: 1 });
  P.hatch(close([...arc(300, 300, 240, 52, 0, Math.PI), ...arc(300, 312, 240, 52, Math.PI, 0)]), {
    angle: 0,
    gap: 1.8,
    t: 6,
    shade: (x) => (x - 300) / 240 + 0.6,
  });
  return P.svg(STYLE);
}

/* ---------------- into your kitchen: the jar on a shelf ---------------- */
function kitchen() {
  const P = Plate(8606, { vignette: false, width: W, height: H });
  const S = 300;
  jar(P, 320, S, 116, 184, 1);
  // a brass lota, a small bowl of lemons, a tin
  const lota = curve(
    [
      [150, S],
      [118, S - 30],
      [116, S - 70],
      [140, S - 96],
      [134, S - 116],
      [178, S - 116],
      [172, S - 96],
      [196, S - 70],
      [194, S - 30],
      [162, S],
    ],
    false,
  );
  P.line(lota, { w: 1.25, t: 1 });
  P.line(arc(156, S - 116, 22, 5), { w: 1, t: 1 });
  P.hatch(close(lota), { angle: 90, gap: 2.2, t: 6, shade: (x) => (x - 156) / 40 + 0.1 });
  P.block(close(lota));
  for (const [x, y] of [
    [466, S - 40],
    [496, S - 46],
    [482, S - 58],
  ]) {
    const l = arc(x, y, 16, 12);
    P.line(l, { w: 0.75, t: 2 });
    P.hatch(l, { angle: 60, gap: 2.4, t: 6, shade: (px, py) => (py - y) / 12 + 0.3 });
    P.block(l);
  }
  P.line(arc(482, S - 34, 44, 8, 0, Math.PI), { w: 1, t: 1 });
  P.line(
    curve([
      [438, S - 34],
      [450, S - 8],
      [482, S],
      [514, S - 8],
      [526, S - 34],
    ]),
    { w: 1, t: 1 },
  );
  P.line(arc(482, S - 34, 44, 8, Math.PI, Math.PI * 2), { w: 0.75, t: 2 });
  P.block(
    close([
      [438, S - 40],
      [526, S - 40],
      [526, S],
      [438, S],
    ]),
  );
  const tin = close([
    [540, S],
    [540, S - 70],
    [596, S - 70],
    [596, S],
  ]);
  P.line(tin, { w: 1, t: 1, taper: false });
  P.line(
    [
      [540, S - 58],
      [596, S - 58],
    ],
    { w: 0.75, t: 2, taper: false },
  );
  P.hatch(tin, { angle: 90, gap: 2.2, t: 6, shade: (x) => (x - 568) / 28 + 0.1 });
  P.block(tin);
  // the shelf and its brackets
  P.line(
    [
      [30, S],
      [610, S],
    ],
    { w: 1.4, t: 1 },
  );
  P.line(
    [
      [30, S + 14],
      [610, S + 14],
    ],
    { w: 1, t: 1 },
  );
  P.hatch(
    close([
      [30, S],
      [610, S],
      [610, S + 14],
      [30, S + 14],
    ]),
    { angle: 0, gap: 2, t: 6 },
  );
  for (const x of [80, 560])
    P.line(
      [
        [x, S + 14],
        [x, S + 60],
        [x + 40, S + 14],
      ],
      { w: 1, t: 2 },
    );
  // the wall: a band of tiles, faint
  for (let y = 40; y < S - 2; y += 52)
    P.line(
      [
        [30, y],
        [610, y],
      ],
      { w: 0.5, t: 7, taper: false, amp: 0 },
    );
  for (let y = 40, r = 0; y < S - 2; y += 52, r++)
    for (let x = 30 + (r % 2) * 26; x < 610; x += 52)
      P.line(
        [
          [x, y],
          [x, Math.min(S - 2, y + 52)],
        ],
        { w: 0.5, t: 7, taper: false, amp: 0 },
      );
  return P.svg(STYLE);
}

/* ---------------- come and see the lake: the horizon, a half sun, birds ---------------- */
function horizon() {
  const P = Plate(8707, { vignette: false, width: W, height: 300 });
  const HZ = 180;
  const c = [320, HZ];
  const R = 70;
  for (let i = 0; i < 5; i++) {
    const y = 24 + i * 6;
    const hh = Math.sqrt(Math.max(0, (R - 2) ** 2 - (R - y) ** 2));
    if (hh > 2)
      P.line(
        [
          [c[0] - hh, HZ - R + y + 10],
          [c[0] + hh, HZ - R + y + 10],
        ],
        { w: 0.5, t: 3, taper: false },
      );
  }
  P.line(arc(c[0], c[1], R, R, Math.PI, Math.PI * 2, 48), { w: 1, t: 1, taper: false });
  // birds, far
  for (const [x, y, s] of [
    [150, 80, 10],
    [176, 66, 8],
    [196, 88, 7],
    [470, 60, 9],
    [494, 74, 7],
  ])
    P.line(
      [
        [x - s, y - s * 0.3],
        [x - s * 0.3, y - s * 0.1],
        [x, y + s * 0.2],
        [x + s * 0.3, y - s * 0.1],
        [x + s, y - s * 0.3],
      ],
      { w: 0.75, t: 4, taper: false },
    );
  // far heaps on the line
  for (const [x, r, h] of [
    [70, 26, 12],
    [110, 18, 8],
    [540, 24, 11],
    [576, 16, 7],
  ])
    mound(P, x, HZ, r, h, { t: 3 });
  P.line(
    [
      [16, HZ],
      [624, HZ],
    ],
    { w: 1.25, t: 1, amp: 0.2 },
  );
  // the sun's path on the water, and the water
  for (let i = 0; i < 8; i++) {
    const y = HZ + 10 + i * 13;
    const hw = 50 - i * 4;
    P.line(
      [
        [c[0] - hw, y],
        [c[0] + hw, y],
      ],
      { w: 0.75, t: 5, taper: 'ends' },
    );
    P.ripple(30 + i * 10, c[0] - hw - 14, y + 3, { t: 7, seg: 40 });
    P.ripple(c[0] + hw + 14, 610 - i * 10, y + 3, { t: 7, seg: 40 });
  }
  return P.svg(STYLE);
}

/* ---------------- the batch checks: five small icons ---------------- */
function icon(seed, draw) {
  const P = Plate(seed, { vignette: false, width: 120, height: 120 });
  draw(P);
  return P.svg(STYLE);
}
const CHECKS = {
  // cleanliness: one clear crystal, a glint
  clean: (P) => {
    crystal(P, 34, 50, 40, 2);
    for (const [a, b] of [
      [
        [86, 22],
        [86, 40],
      ],
      [
        [77, 31],
        [95, 31],
      ],
    ])
      P.line([a, b], { w: 0.75, t: 1, taper: false });
  },
  // crystal size: three crystals in a row, a rule under them
  size: (P) => {
    crystal(P, 12, 60, 14, 2);
    crystal(P, 42, 52, 22, 2);
    crystal(P, 78, 42, 30, 2);
    P.line(
      [
        [10, 98],
        [112, 98],
      ],
      { w: 1, t: 1, taper: false },
    );
    for (let x = 10; x <= 112; x += 8.5)
      P.line(
        [
          [x, 98],
          [x, x % 17 < 1 ? 92 : 95],
        ],
        { w: 0.5, t: 3, taper: false, amp: 0 },
      );
  },
  // moisture: a drop over a little heap
  moisture: (P) => {
    const drop = curve([
      [60, 14],
      [74, 38],
      [78, 54],
      [70, 66],
      [60, 68],
      [50, 66],
      [42, 54],
      [46, 38],
      [60, 14],
    ]);
    P.line(drop, { w: 1, t: 1 });
    P.hatch(drop, { angle: 80, gap: 2.2, t: 4, shade: (x) => (x - 60) / 18 + 0.2 });
    P.block(drop);
    mound(P, 60, 104, 40, 22, { t: 2 });
  },
  // colour: a dish of salt, half in shade, a swatch strip
  colour: (P) => {
    P.line(arc(60, 56, 44, 44), { w: 1, t: 1 });
    P.line(arc(60, 56, 36, 36), { w: 0.5, t: 2, taper: false });
    P.hatch(arc(60, 56, 35, 35), { angle: 45, gap: 2.4, t: 4, shade: (x) => (x - 60) / 30 + 0.4 });
    for (let i = 0; i < 4; i++) {
      const r = close([
        [16 + i * 23, 106],
        [36 + i * 23, 106],
        [36 + i * 23, 114],
        [16 + i * 23, 114],
      ]);
      P.line(r, { w: 0.75, t: 3, taper: false });
      P.hatch(r, { angle: 0, gap: 4 - i * 0.8, t: 5 });
    }
  },
  // taste: a spoon with a pinch of grains
  taste: (P) => {
    const bowl = arc(46, 58, 28, 18);
    P.line(bowl, { w: 1.25, t: 1 });
    for (let i = 0; i < 18; i++) {
      const x = 32 + P.rnd() * 28;
      const y = 52 + P.rnd() * 10;
      P.line(
        [
          [x, y],
          [x + 1.6, y + 0.4],
        ],
        { w: 0.75, t: 3, taper: false, amp: 0 },
      );
    }
    P.hatch(bowl, { angle: 20, gap: 2.4, t: 4, shade: (x, y) => (y - 58) / 18 + 0.2 });
    P.block(bowl);
    P.line(
      [
        [72, 52],
        [112, 30],
      ],
      { w: 1.4, t: 1 },
    );
    P.line(
      [
        [73, 58],
        [112, 34],
      ],
      { w: 0.75, t: 2 },
    );
  },
};

/** The panorama (its three layers, from disk) and its constants (panorama.ts). */
function panorama() {
  const ts = readFileSync(join(here, '../../components/sections/Journey/panorama.ts'), 'utf8');
  const P = new Function(
    `return ${ts.match(/export const PANORAMA = (\{[\s\S]*?\}) as const;/)[1]}`,
  )();
  const LIVE = new Function(
    `return ${ts.match(/export const LIVE = (\{[\s\S]*?\}) as const;/)[1]}`,
  )();
  const layers = Object.fromEntries(
    ['sky', 'far', 'near'].map((l) => [l, readFileSync(join(OUT, `journey-${l}.svg`), 'utf8')]),
  );
  return { P, LIVE, layers };
}

export function buildPages() {
  const { P, LIVE, layers } = panorama();
  const L = P.layers;
  const files = {};
  // the Journey's first four scenes (05's jar is the homepage's live overlay), each as one plate (its centre at the near layer's; 820 × 512)
  for (let s = 0; s < 4; s++) {
    const c = L.near.centers[s];
    const extra = s === 2 ? LIVE.rake.html : '';
    files[`scene-${s + 1}`] = composite(
      layers,
      L,
      s,
      [Math.round(c - 410), 0, 820, 512],
      extra,
    ).replace(/^(<svg[^>]*>)/, `$1${STYLE}`);
  }
  Object.assign(files, {
    'page-refinery': refinery(),
    'page-bench': bench(),
    'page-packing': packing(),
    'page-heaps': heaps(),
    'page-checking': checking(),
    'page-kitchen': kitchen(),
    'page-horizon': horizon(),
  });
  let seed = 8900;
  for (const [name, draw] of Object.entries(CHECKS)) files[`check-${name}`] = icon(seed++, draw);
  for (const [name, svg] of Object.entries(files)) {
    writeFileSync(join(OUT, `${name}.svg`), svg);
    console.log(`${name}.svg`, (svg.length / 1024).toFixed(1) + ' KB');
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) buildPages();
