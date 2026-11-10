/**
 * Crystal Dawn: the loader scene, drawn with Canvas 2D as a pure function of `DawnState`.
 *
 * Built so a frame allocates nothing: glows are pre-rendered sprites, colours are fixed strings
 * with `globalAlpha` doing the fading, projected points live in typed arrays, the background
 * and the salt-pan cracks are cached on their own canvases.
 */

export interface DawnState {
  /** seconds since the start: drives the slow, continuous rotation (12°/s) */
  t: number;
  /** 0–1: the horizon line drawing outward from the centre */
  horizon: number;
  /** 0–1: the point of light */
  seed: number;
  /** 0–1: crystal growth (outer edges 0–.45, hopper steps .45–.8, side steps, base cube) */
  grow: number;
  /** 0–1: the sun glow rising behind the crystal; lights the cracks from the centre */
  sun: number;
  /** -1 or 0–1: the glint running round the hopper rim and spiralling to the centre */
  glint: number;
  /** -1 or seconds since the release: the grains falling */
  release: number;
  /** 0–1: the crystal dissolving */
  fade: number;
  /** 0–1: the horizon brightening as it takes in the grains */
  absorb: number;
  /** 0–1 (eased): the horizon opening, sky up and ground down */
  open: number;
  /** the seam line; when absent it is the horizon, drawn from the centre */
  line: { x: number; y: number; w: number } | null;
}

export interface DawnLayout {
  W: number;
  H: number;
  cx: number;
  cy: number;
  hy: number;
  L: number;
}

const TILT = (25 * Math.PI) / 180;
const COS_T = Math.cos(TILT);
const SIN_T = Math.sin(TILT);
const GOLD = '#a8823f'; // gold-500
const IVORY_LINE = '#fffdf7';
const NAVY = '#18214a';
// grains: gold-500 → gold-300 in four steps
const GRAIN_COLORS = ['#a8823f', '#b49048', '#c19c52', '#cda75e'];
const N_BUCKETS = 8; // 4 colours × 2 alpha levels

const clamp = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const smooth = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const expoOut = (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));

// ---- cube topology (unit cube, ±1) ----
const V = [
  [-1, -1, -1],
  [1, -1, -1],
  [1, 1, -1],
  [-1, 1, -1],
  [-1, -1, 1],
  [1, -1, 1],
  [1, 1, 1],
  [-1, 1, 1],
] as const;
const FACES = [
  { n: [0, 0, 1], v: [4, 5, 6, 7] },
  { n: [0, 0, -1], v: [1, 0, 3, 2] },
  { n: [1, 0, 0], v: [5, 1, 2, 6] },
  { n: [-1, 0, 0], v: [0, 4, 7, 3] },
  { n: [0, 1, 0], v: [7, 6, 2, 3] },
  { n: [0, -1, 0], v: [0, 1, 5, 4] },
] as const;
const EDGES = (
  [
    [7, 6],
    [6, 2],
    [2, 3],
    [3, 7],
    [7, 4],
    [6, 5],
    [2, 1],
    [3, 0],
    [4, 5],
    [5, 1],
    [1, 0],
    [0, 4],
  ] as const
).map(([a, b]) => ({
  a,
  b,
  f: FACES.map((f, i) =>
    (f.v as readonly number[]).includes(a) && (f.v as readonly number[]).includes(b) ? i : -1,
  ).filter((i) => i >= 0),
}));

// ---- the hopper crystal ----
const HOP = 5; // nested squares stepping in and down on the top face
const STEP_IN = 0.078;
const STEP_DOWN = 0.058;
const SIDE_STEPS = 2;
const UP = [0, 1, 0] as const;
const ringS = (i: number) => 0.5 - i * STEP_IN;
const ringY = (i: number) => 0.5 - i * STEP_DOWN;
const ringAlpha = (i: number) => 1 - (i / HOP) * 0.65; // 1.0 → 0.35 towards the centre
/** One small cube (15%) flush against the base corner of the +x and −z faces. */
const BUD_H = 0.075;
const BUD_C = [0.5 + BUD_H, -0.5 + BUD_H, -0.5 + BUD_H] as const;

// the glint's path: round the rim, then inward ring by ring, to the centre point
const SPIRAL: number[] = [];
for (let i = 0; i <= HOP; i++) {
  const s = ringS(i),
    y = ringY(i);
  const c = [
    [s, y, s],
    [-s, y, s],
    [-s, y, -s],
    [s, y, -s],
  ];
  for (let k = 0; k < (i === 0 ? 5 : 4); k++) SPIRAL.push(...c[(k + i) % 4]!);
}
SPIRAL.push(0, ringY(HOP) - STEP_DOWN * 0.6, 0);
const SPIRAL_N = SPIRAL.length / 3;

function sprite(size: number, stops: [number, string][]): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  const gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  for (const [o, col] of stops) gr.addColorStop(o, col);
  g.fillStyle = gr;
  g.fillRect(0, 0, size, size);
  return c;
}

/** A radial glow (1 → 0.45 at 40% → 0) with per-pixel noise, so it has no banding when faint. */
function ditheredGlow(size: number, [r, g, b]: [number, number, number]): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const x = c.getContext('2d')!;
  const img = x.createImageData(size, size);
  const d = img.data;
  let s = 7;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let j = 0; j < size; j++)
    for (let i = 0; i < size; i++) {
      const q = Math.hypot(i + 0.5 - size / 2, j + 0.5 - size / 2) / (size / 2);
      const a = q >= 1 ? 0 : q < 0.4 ? 1 - (q / 0.4) * 0.55 : 0.45 * (1 - (q - 0.4) / 0.6);
      const k = (j * size + i) * 4;
      d[k] = r;
      d[k + 1] = g;
      d[k + 2] = b;
      d[k + 3] = Math.max(0, Math.min(255, Math.floor(a * 255 + rnd() * 3 - 1)));
    }
  x.putImageData(img, 0, 0);
  return c;
}

export function createDawn(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable');
  const layer = document.createElement('canvas'); // the crystal (hidden lines)
  const lctx = layer.getContext('2d')!;
  const buf = document.createElement('canvas'); // the whole dawn, split when the horizon opens
  const bctx = buf.getContext('2d')!;
  const bg = document.createElement('canvas'); // ivory warming into dawn
  const crustC = document.createElement('canvas'); // the cracks, redrawn only as the sun rises
  const cctx = crustC.getContext('2d')!;

  // sprites (once)
  // the sun glow is drawn huge at ~6–12% alpha: dither it, or 8-bit steps show as rings
  const GLOW_GOLD = ditheredGlow(256, [168, 130, 63]);
  const GLOW_GOLD3 = sprite(128, [
    [0, 'rgba(205,167,94,1)'],
    [0.4, 'rgba(205,167,94,0.45)'],
    [1, 'rgba(205,167,94,0)'],
  ]);
  const GLOW_WHITE = sprite(128, [
    [0, 'rgba(255,250,240,1)'],
    [0.4, 'rgba(255,250,240,0.45)'],
    [1, 'rgba(255,250,240,0)'],
  ]);
  const ELLIPSE = sprite(256, [
    [0, 'rgba(205,167,94,1)'],
    [0.5, 'rgba(205,167,94,0.35)'],
    [1, 'rgba(205,167,94,0)'],
  ]);
  const SEED = sprite(256, [
    [0, 'rgba(255,250,240,1)'],
    [0.04, 'rgba(255,250,240,0.85)'],
    [0.1, 'rgba(205,167,94,0.25)'],
    [0.4, 'rgba(205,167,94,0.07)'],
    [1, 'rgba(205,167,94,0)'],
  ]);
  // a face's glass gradient: 0.15 at the top → 0.45 at the sunward bottom (ivory-white + 8% gold-300)
  const FACE_GRAD = document.createElement('canvas');
  FACE_GRAD.width = 1;
  FACE_GRAD.height = 128;
  {
    const g = FACE_GRAD.getContext('2d')!;
    const gr = g.createLinearGradient(0, 0, 0, 128);
    gr.addColorStop(0, 'rgba(251,246,234,0.15)');
    gr.addColorStop(1, 'rgba(251,246,234,0.45)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 1, 128);
  }

  // a static grain, ±2 levels: breaks the 8-bit steps of the faint glows (else they show as rings)
  const NOISE = document.createElement('canvas');
  NOISE.width = NOISE.height = 128;
  {
    const g = NOISE.getContext('2d')!;
    const img = g.createImageData(128, 128);
    let s = 3;
    const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
    for (let k = 0; k < img.data.length; k += 4) {
      const light = rnd() < 0.5;
      img.data[k] = img.data[k + 1] = img.data[k + 2] = light ? 255 : 40;
      img.data[k + 3] = Math.floor(rnd() * 9);
    }
    g.putImageData(img, 0, 0);
  }
  const noiseMain = ctx.createPattern(NOISE, 'repeat')!;
  const noiseBuf = bctx.createPattern(NOISE, 'repeat')!;

  let W = 0,
    H = 0,
    dpr = 1,
    L = 0,
    cx = 0,
    cy = 0,
    hy = 0,
    phone = false;
  let ang = 0,
    ca = 1,
    sa = 0;
  let crustSun = -1;

  // scratch (no allocation per frame)
  const P = new Float32Array(8 * 3); // a box's projected vertices: x, y, z
  const Q = new Float32Array(4 * 3); // one hopper ring
  const Qprev = new Float32Array(4 * 3);
  const SP = new Float32Array(SPIRAL_N * 3);
  const FA = new Float32Array(6);
  const MAIN = new Float32Array(8 * 3);
  const r3 = new Float32Array(3);

  function rot(x: number, y: number, z: number) {
    const xr = x * ca + z * sa,
      zr = -x * sa + z * ca;
    // tilt towards the viewer (who sits at −z), so we look down onto the top face
    r3[0] = xr;
    r3[1] = y * COS_T + zr * SIN_T;
    r3[2] = -y * SIN_T + zr * COS_T;
  }
  function proj(x: number, y: number, z: number, out: Float32Array, o: number) {
    rot(x, y, z);
    const k = 1 / (1 + r3[2]! * 0.16);
    out[o] = cx + r3[0]! * L * k;
    out[o + 1] = cy - r3[1]! * L * k;
    out[o + 2] = r3[2]!;
  }
  const facing = (n: readonly number[]) => {
    rot(n[0]!, n[1]!, n[2]!);
    return -r3[2]!;
  };

  // ---- salt-pan crust: irregular cracked polygons (hex lattice, shared jittered vertices) ----
  let crust: { pts: Float32Array; d: number; far: number }[] = [];
  const hash = (x: number, z: number) => {
    const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
    return s - Math.floor(s);
  };
  function buildCrust() {
    crust = [];
    const r = 1,
      w = Math.sqrt(3) * r,
      Z0 = 2.2,
      K = (H - hy) * Z0,
      S = K * 0.62;
    for (let row = 1; row < 24; row++)
      for (let col = -30; col <= 30; col++) {
        const gx = col * w + ((row % 2) * w) / 2,
          gz = Z0 + row * 1.5 * r;
        const pts = new Float32Array(12);
        for (let k = 0; k < 6; k++) {
          const a = Math.PI / 6 + (k * Math.PI) / 3;
          let X = gx + r * Math.cos(a),
            Z = gz + r * Math.sin(a);
          const qx = Math.round(X * 100),
            qz = Math.round(Z * 100);
          X += (hash(qx, qz) - 0.5) * 0.78;
          Z += (hash(qz, qx + 7) - 0.5) * 0.78;
          pts[k * 2] = W / 2 + (X * S) / Z;
          pts[k * 2 + 1] = hy + K / Z;
        }
        const mx = (pts[0]! + pts[6]!) / 2,
          my = (pts[1]! + pts[7]!) / 2;
        const d = Math.hypot((mx - W / 2) / (W / 2), (my - hy) / (H - hy));
        if (d > 0.95) continue; // the elliptical mask: no cracks reach the sides
        const far = clamp((my - hy) / ((H - hy) * 0.24));
        crust.push({ pts, d, far: far * far });
      }
    crustSun = -1;
  }
  function drawCrust(sun: number) {
    cctx.setTransform(1, 0, 0, 1, 0, 0);
    cctx.clearRect(0, 0, crustC.width, crustC.height);
    cctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cctx.strokeStyle = NAVY;
    cctx.lineWidth = dpr >= 2 ? 0.75 : 1;
    const reach = sun * 1.3;
    for (const c of crust) {
      const mask = 1 - smooth(0.3, 0.92, c.d); // full under the crystal, gone at the edges
      const lit = clamp((reach - c.d) / 0.45) * c.far * mask;
      if (lit <= 0.01) continue;
      cctx.globalAlpha = (0.04 + 0.02 * clamp(1 - c.d)) * lit;
      const q = c.pts;
      cctx.beginPath();
      cctx.moveTo(q[0]!, q[1]!);
      for (let j = 2; j < 12; j += 2) cctx.lineTo(q[j]!, q[j + 1]!);
      cctx.closePath();
      cctx.stroke();
    }
    cctx.globalAlpha = 1;
    crustSun = sun;
  }

  // ---- grains (typed arrays, sampled once at the release) ----
  const N_MAX = 820;
  const gx0 = new Float32Array(N_MAX),
    gy0 = new Float32Array(N_MAX);
  const gvx = new Float32Array(N_MAX),
    gvy = new Float32Array(N_MAX);
  const gsz = new Float32Array(N_MAX),
    gbk = new Uint8Array(N_MAX),
    gsp = new Uint8Array(N_MAX);
  let nGrains = 0;
  function sampleGrains() {
    let s = 23;
    const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
    nGrains = phone ? 360 : 820;
    for (let i = 0; i < nGrains; i++) {
      const bud = rnd() < 0.08;
      const cxb = bud ? BUD_C[0] : 0,
        cyb = bud ? BUD_C[1] : 0,
        czb = bud ? BUD_C[2] : 0;
      const h = bud ? BUD_H : 0.5;
      const e = EDGES[Math.floor(rnd() * 12)]!,
        u = rnd(),
        inset = rnd() < 0.4 ? 0.3 + rnd() * 0.7 : 1;
      const A = V[e.a],
        B = V[e.b];
      proj(
        cxb + h * inset * (A[0] + (B[0] - A[0]) * u),
        cyb + h * inset * (A[1] + (B[1] - A[1]) * u),
        czb + h * inset * (A[2] + (B[2] - A[2]) * u),
        P,
        0,
      );
      gx0[i] = P[0]!;
      gy0[i] = P[1]!;
      gvx[i] = ((P[0]! - cx) / L) * 26 + (rnd() - 0.5) * 22;
      gvy[i] = -10 - rnd() * 34;
      gsz[i] = 0.8 + rnd() * 1.2;
      gbk[i] = Math.floor(rnd() * 4) * 2 + (rnd() < 0.5 ? 0 : 1);
      gsp[i] = rnd() < 0.1 ? 1 : 0;
    }
  }

  function glow(
    g: CanvasRenderingContext2D,
    spr: HTMLCanvasElement,
    x: number,
    y: number,
    r: number,
    a: number,
  ) {
    if (a <= 0) return;
    g.globalAlpha = a;
    g.drawImage(spr, x - r, y - r, r * 2, r * 2);
    g.globalAlpha = 1;
  }

  function resize(w: number, h: number, ratio: number) {
    W = w;
    H = h;
    dpr = Math.min(2, ratio || 1);
    phone = w < 700;
    for (const c of [canvas, layer, buf, bg, crustC]) {
      c.width = Math.round(w * dpr);
      c.height = Math.round(h * dpr);
    }
    hy = Math.floor(h * 0.58) + 0.5; // the same pixel row as the CSS horizon (round down)
    // the crystal at the approved size (18% of the width on desktop, 40% on phones)
    L = Math.min((w * (phone ? 0.4 : 0.18)) / (phone ? 1.4 : 1.3), h * 0.21);
    cx = w / 2 - L * 0.12;
    cy = hy - L * 0.98;
    const g = bg.getContext('2d')!;
    const gr = g.createLinearGradient(0, 0, 0, bg.height);
    gr.addColorStop(0, '#f5f1e8');
    gr.addColorStop(0.5, '#f5f1e8');
    gr.addColorStop(1, '#efe6d6');
    g.fillStyle = gr;
    g.fillRect(0, 0, bg.width, bg.height);
    buildCrust();
    nGrains = 0;
  }

  // ---- one box: hidden lines, glass faces, inner highlights; the main cube adds its hopper ----
  function drawBox(
    g: CanvasRenderingContext2D,
    bx: number,
    by: number,
    bz: number,
    h: number,
    main: boolean,
    edgeProg: number,
    faceA: number,
    grow: number,
    edgeA: number,
  ) {
    for (let k = 0; k < 8; k++)
      proj(bx + V[k]![0] * h, by + V[k]![1] * h, bz + V[k]![2] * h, P, k * 3);
    for (let i = 0; i < 6; i++) FA[i] = smooth(-0.06, 0.08, facing(FACES[i]!.n));
    const poly = (f: (typeof FACES)[number]) => {
      g.beginPath();
      g.moveTo(P[f.v[0] * 3]!, P[f.v[0] * 3 + 1]!);
      for (let j = 1; j < 4; j++) g.lineTo(P[f.v[j]! * 3]!, P[f.v[j]! * 3 + 1]!);
      g.closePath();
    };
    // solid: erase what lies behind this box's front faces
    if (faceA > 0) {
      g.globalCompositeOperation = 'destination-out';
      g.fillStyle = '#000';
      for (let i = 0; i < 6; i++) {
        if (FA[i]! <= 0) continue;
        g.globalAlpha = faceA * FA[i]!;
        poly(FACES[i]!);
        g.fill();
      }
      g.globalCompositeOperation = 'source-over';
      g.globalAlpha = 1;
      // glass: a per-face gradient, brighter towards the sun at the bottom
      for (let i = 0; i < 6; i++) {
        if (FA[i]! <= 0) continue;
        const f = FACES[i]!;
        let y0 = 1e9,
          y1 = -1e9,
          x0 = 1e9,
          x1 = -1e9;
        for (const k of f.v) {
          const x = P[k * 3]!,
            y = P[k * 3 + 1]!;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
        }
        g.save();
        poly(f);
        g.clip();
        g.globalAlpha = faceA * FA[i]!;
        g.drawImage(FACE_GRAD, x0, y0, x1 - x0 + 1, y1 - y0 + 1);
        g.restore();
      }
    }
    const lw = dpr >= 2 ? 0.85 : 1;
    g.lineWidth = lw;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.strokeStyle = GOLD;
    for (let i = 0; i < 12; i++) {
      const e = EDGES[i]!;
      let vis = 0;
      for (const fi of e.f) if (FA[fi]! > vis) vis = FA[fi]!;
      const alpha = edgeA * (vis + (main ? 0.14 * (1 - vis) : 0)); // back edges 14% (main only)
      const ek = main ? clamp(((edgeProg - i / 14) * 14) / 3) : 1;
      if (ek <= 0 || alpha <= 0.005) continue;
      const ax = P[e.a * 3]!,
        ay = P[e.a * 3 + 1]!,
        u = expoOut(ek);
      const x = ax + (P[e.b * 3]! - ax) * u,
        y = ay + (P[e.b * 3 + 1]! - ay) * u;
      g.globalAlpha = alpha;
      g.beginPath();
      g.moveTo(ax, ay);
      g.lineTo(x, y);
      g.stroke();
      if (ek < 1) glow(g, GLOW_GOLD3, x, y, 6, 0.55 * alpha); // a drawing edge ends in a soft glint
    }
    // a 1px ivory highlight just inside each front edge, so the faces read as glass
    if (faceA > 0) {
      g.strokeStyle = IVORY_LINE;
      g.lineWidth = Math.min(1, lw);
      for (let i = 0; i < 6; i++) {
        if (FA[i]! < 0.35) continue;
        const f = FACES[i]!;
        let mx = 0,
          my = 0;
        for (const k of f.v) {
          mx += P[k * 3]! / 4;
          my += P[k * 3 + 1]! / 4;
        }
        g.globalAlpha = 0.6 * faceA * FA[i]!;
        g.beginPath();
        for (let j = 0; j < 4; j++) {
          const k = f.v[j]!,
            px = P[k * 3]!,
            py = P[k * 3 + 1]!;
          const d = Math.hypot(px - mx, py - my) || 1;
          const x = px + ((mx - px) / d) * 2.8,
            y = py + ((my - py) / d) * 2.8;
          if (j) g.lineTo(x, y);
          else g.moveTo(x, y);
        }
        g.closePath();
        g.stroke();
      }
      g.strokeStyle = GOLD;
    }
    g.globalAlpha = 1;
    if (!main) return;
    MAIN.set(P);

    // the hopper: nested squares stepping in and down on the top face, outside in
    const top = smooth(-0.06, 0.08, facing(UP));
    if (top > 0) {
      g.lineWidth = lw;
      for (let k = 0; k < 4; k++)
        proj(k === 0 || k === 3 ? 0.5 : -0.5, 0.5, k < 2 ? 0.5 : -0.5, Qprev, k * 3);
      for (let i = 1; i <= HOP; i++) {
        const kd = clamp((grow - 0.45 - (i - 1) * 0.07) / 0.1);
        if (kd <= 0) break;
        const s = ringS(i),
          y = ringY(i);
        for (let k = 0; k < 4; k++) proj(k === 0 || k === 3 ? s : -s, y, k < 2 ? s : -s, Q, k * 3);
        const alpha = edgeA * ringAlpha(i) * top;
        g.globalAlpha = alpha;
        g.beginPath();
        g.moveTo(Q[0]!, Q[1]!);
        const n = Math.ceil(4 * kd);
        for (let k = 1; k <= n; k++) g.lineTo(Q[(k % 4) * 3]!, Q[(k % 4) * 3 + 1]!);
        g.stroke();
        if (kd >= 1) {
          g.globalAlpha = alpha * 0.6; // short corner steps up to the ring above
          g.beginPath();
          for (let k = 0; k < 4; k++) {
            g.moveTo(Qprev[k * 3]!, Qprev[k * 3 + 1]!);
            g.lineTo(Q[k * 3]!, Q[k * 3 + 1]!);
          }
          g.stroke();
        }
        Qprev.set(Q);
      }
    }
    // two shallow steps on each visible side face, at half strength, so the top leads
    const kSide = smooth(0.5, 0.8, grow);
    if (kSide > 0) {
      for (let i = 0; i < 6; i++) {
        const f = FACES[i]!;
        if (f.n[1] !== 0 || FA[i]! < 0.3) continue;
        const nx = f.n[0],
          nz = f.n[2],
          ux = nz,
          uz = -nx;
        for (let j = 1; j <= SIDE_STEPS; j++) {
          const m = 0.5 - j * 0.1,
            d = 0.5 - j * 0.03;
          g.globalAlpha = edgeA * (0.45 - j * 0.1) * 0.5 * FA[i]! * kSide;
          g.beginPath();
          for (let k = 0; k < 4; k++) {
            const su = k === 0 || k === 3 ? 1 : -1,
              sv = k < 2 ? 1 : -1;
            proj(nx * d + ux * m * su, m * sv, nz * d + uz * m * su, Q, 0);
            if (k) g.lineTo(Q[0]!, Q[1]!);
            else g.moveTo(Q[0]!, Q[1]!);
          }
          g.closePath();
          g.stroke();
        }
      }
    }
    g.globalAlpha = 1;
  }

  function grain(g: CanvasRenderingContext2D, pat: CanvasPattern) {
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = pat;
    g.fillRect(0, 0, canvas.width, canvas.height);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function scene(g: CanvasRenderingContext2D, st: DawnState, withBg: boolean) {
    g.setTransform(1, 0, 0, 1, 0, 0);
    if (withBg) g.drawImage(bg, 0, 0);
    else g.clearRect(0, 0, canvas.width, canvas.height);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const sun = st.sun;
    if (sun > 0) {
      g.save();
      g.beginPath();
      g.rect(0, 0, W, hy);
      g.clip(); // the sun is behind the horizon: its glow lights the sky only
      glow(
        g,
        GLOW_GOLD,
        cx,
        hy + L * 0.6 - sun * L * 1.5,
        L * (2.6 + sun * 1.6),
        0.06 + 0.06 * sun,
      );
      g.restore();
      // light on the pans (an elliptical glow below the line)
      g.save();
      g.beginPath();
      g.rect(0, hy, W, H - hy);
      g.clip();
      const rx = W * 0.5 * (0.4 + sun * 0.6),
        ry = (H - hy) * 0.6;
      g.globalAlpha = 0.06 * sun * 1.6;
      g.drawImage(GLOW_GOLD, cx - rx, hy - ry, rx * 2, ry * 2);
      g.globalAlpha = 1;
      g.restore();
      if (Math.abs(sun - crustSun) > 0.02 || (sun === 1 && crustSun !== 1)) drawCrust(sun);
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.drawImage(crustC, 0, 0);
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    if (st.absorb > 0) {
      g.globalAlpha = 0.3 * st.absorb;
      g.drawImage(ELLIPSE, cx - W * 0.36, hy - 7, W * 0.72, 14);
      g.globalAlpha = 1;
    }
    // seed: a bloom with no edge
    const a = st.seed * (1 - smooth(0.04, 0.22, st.grow));
    if (a > 0) glow(g, SEED, cx, cy, phone ? 44 : 54, a);

    // the crystal, on its own layer (hidden lines)
    const keep = 1 - st.fade;
    let haveMain = false;
    if (st.grow > 0 && keep > 0) {
      const x0 = Math.max(0, Math.floor((cx - L * 1.4) * dpr)),
        y0 = Math.max(0, Math.floor((cy - L * 1.5) * dpr));
      const w0 = Math.min(layer.width - x0, Math.ceil(L * 2.8 * dpr)),
        h0 = Math.min(layer.height - y0, Math.ceil(L * 2.7 * dpr));
      lctx.setTransform(1, 0, 0, 1, 0, 0);
      lctx.clearRect(x0, y0, w0, h0);
      lctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const faceA = smooth(0.35, 0.55, st.grow);
      const budP = smooth(0.85, 0.97, st.grow);
      rot(BUD_C[0], BUD_C[1], BUD_C[2]);
      const budBehind = r3[2]! > 0;
      const drawBud = () => {
        if (budP <= 0) return;
        const h = BUD_H * expoOut(budP);
        // grows out of the +x face, its base held flush on the corner
        drawBox(
          lctx,
          0.5 + h,
          -0.5 + h,
          -0.5 + h,
          h,
          false,
          1,
          faceA * smooth(0, 0.5, budP),
          st.grow,
          smooth(0, 0.35, budP),
        );
      };
      if (budBehind) drawBud();
      drawBox(lctx, 0, 0, 0, 0.5, true, clamp(st.grow / 0.45), faceA, st.grow, 1);
      haveMain = true;
      if (!budBehind) drawBud();
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.globalAlpha = keep;
      g.drawImage(layer, x0, y0, w0, h0, x0, y0, w0, h0);
      g.globalAlpha = 1;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    // C: the glint runs round the rim and spirals inward, ending at the centre
    if (st.glint >= 0 && haveMain) {
      for (let k = 0; k < SPIRAL_N; k++)
        proj(SPIRAL[k * 3]!, SPIRAL[k * 3 + 1]!, SPIRAL[k * 3 + 2]!, SP, k * 3);
      const segs = SPIRAL_N - 1,
        f = st.glint * segs,
        i = Math.min(segs - 1, Math.floor(f)),
        u = f - i;
      g.strokeStyle = '#fff8e6';
      g.lineWidth = 1.1;
      g.lineCap = 'round';
      // a short tail: this segment and the one before, fading back
      for (let k = 0; k <= 1; k++) {
        const j = i - k;
        if (j < 0) break;
        const ax = SP[j * 3]!,
          ay = SP[j * 3 + 1]!,
          bx = SP[(j + 1) * 3]!,
          by = SP[(j + 1) * 3 + 1]!;
        const u1 = k === 0 ? u : 1,
          u0 = k === 0 ? Math.max(0, u - 0.7) : Math.min(1, Math.max(0, u + 0.3));
        if (u1 <= u0) continue;
        g.globalAlpha = k === 0 ? 0.95 : 0.4;
        g.beginPath();
        g.moveTo(ax + (bx - ax) * u0, ay + (by - ay) * u0);
        g.lineTo(ax + (bx - ax) * u1, ay + (by - ay) * u1);
        g.stroke();
      }
      g.globalAlpha = 1;
      const ax = SP[i * 3]!,
        ay = SP[i * 3 + 1]!;
      glow(
        g,
        GLOW_WHITE,
        ax + (SP[(i + 1) * 3]! - ax) * u,
        ay + (SP[(i + 1) * 3 + 1]! - ay) * u,
        9,
        0.6,
      );
      if (st.glint > 0.9) {
        const ex = SP[segs * 3]!,
          ey = SP[segs * 3 + 1]!,
          s = 8 * smooth(0.9, 1, st.glint);
        glow(g, GLOW_WHITE, ex, ey, s * 2.2, 0.5);
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(ex - s, ey);
        g.lineTo(ex + s, ey);
        g.moveTo(ex, ey - s * 1.3);
        g.lineTo(ex, ey + s * 1.3);
        g.stroke();
        g.lineWidth = 0.6;
        const d = s * 0.32;
        g.beginPath();
        g.moveTo(ex - d, ey - d);
        g.lineTo(ex + d, ey + d);
        g.moveTo(ex + d, ey - d);
        g.lineTo(ex - d, ey + d);
        g.stroke();
      }
    }

    // D: the grains fall with gravity and drift, streak a little, and vanish into the horizon
    if (st.release >= 0) {
      if (!nGrains) sampleGrains();
      const T = st.release,
        grav = phone ? 700 : 900;
      g.lineCap = 'round';
      for (let b = 0; b < N_BUCKETS; b++) {
        g.strokeStyle = GRAIN_COLORS[b >> 1]!;
        g.globalAlpha = b & 1 ? 0.85 : 0.55;
        g.beginPath();
        for (let i = 0; i < nGrains; i++) {
          if (gbk[i] !== b || gsp[i]) continue;
          const lag = clamp((cy + L * 0.6 - gy0[i]!) / (L * 2)) * 0.16; // the top lets go last
          const tt = T - lag;
          if (tt < 0) continue;
          const vy = gvy[i]! + grav * tt;
          const x = gx0[i]! + gvx[i]! * tt,
            y = gy0[i]! + gvy[i]! * tt + 0.5 * grav * tt * tt;
          if (y >= hy - 0.5) continue;
          // a short motion streak along the velocity (12 ms), at least the grain's own size
          const sx = gvx[i]! * 0.012,
            sy = Math.max(gsz[i]!, vy * 0.012);
          g.moveTo(x - sx, y - sy);
          g.lineTo(x, y);
        }
        g.lineWidth = b & 1 ? 1.5 : 1;
        g.stroke();
      }
      g.globalAlpha = 1;
      for (let i = 0; i < nGrains; i++) {
        if (!gsp[i]) continue;
        const lag = clamp((cy + L * 0.6 - gy0[i]!) / (L * 2)) * 0.16,
          tt = T - lag;
        if (tt < 0) continue;
        const x = gx0[i]! + gvx[i]! * tt,
          y = gy0[i]! + gvy[i]! * tt + 0.5 * grav * tt * tt;
        if (y >= hy - 0.5) continue;
        glow(g, GLOW_WHITE, x, y, gsz[i]! * 2.6, 0.85 * clamp((hy - y) / 26));
      }
    }
    grain(g, g === ctx ? noiseMain : noiseBuf);
  }

  function render(st: DawnState) {
    ang = 0.62 + (st.t * 12 * Math.PI) / 180;
    ca = Math.cos(ang);
    sa = Math.sin(ang);
    if (st.open <= 0) scene(ctx!, st, false);
    else {
      // E: the horizon opens: the sky lifts, the ground drops, 40px feathered edges
      scene(bctx, st, true);
      ctx!.setTransform(1, 0, 0, 1, 0, 0);
      ctx!.clearRect(0, 0, canvas.width, canvas.height);
      const up = st.open * (hy + 60),
        down = st.open * (H - hy + 60),
        F = 40;
      const hyd = Math.round(hy * dpr);
      ctx!.drawImage(buf, 0, 0, buf.width, hyd, 0, Math.round(-up * dpr), buf.width, hyd);
      ctx!.drawImage(
        buf,
        0,
        hyd,
        buf.width,
        buf.height - hyd,
        0,
        Math.round((hy + down) * dpr),
        buf.width,
        buf.height - hyd,
      );
      // feathers: erase along each moving edge with the pre-rendered falloff
      ctx!.globalCompositeOperation = 'destination-out';
      ctx!.globalAlpha = smooth(0, 0.04, st.open);
      ctx!.drawImage(FEATHER_UP, 0, Math.round((hy - up - F) * dpr), buf.width, F * dpr);
      ctx!.drawImage(FEATHER_DOWN, 0, Math.round((hy + down) * dpr), buf.width, F * dpr);
      ctx!.globalAlpha = 1;
      ctx!.globalCompositeOperation = 'source-over';
    }
    // the one gold line: the horizon, later the seam that settles onto the hero's Horizon
    ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx!.fillStyle = GOLD;
    ctx!.globalAlpha = 0.88 + 0.12 * st.absorb;
    if (st.line) ctx!.fillRect(st.line.x, st.line.y - 0.5, st.line.w, 1);
    else {
      const hw = (expoOut(clamp(st.horizon)) * W) / 2;
      ctx!.fillRect(W / 2 - hw, hy - 0.5, hw * 2, 1);
    }
    ctx!.globalAlpha = 1;
  }

  // feather masks (alpha falloff over 40px), drawn with destination-out
  const FEATHER_UP = document.createElement('canvas');
  const FEATHER_DOWN = document.createElement('canvas');
  for (const [c, up] of [
    [FEATHER_UP, true],
    [FEATHER_DOWN, false],
  ] as const) {
    c.width = 1;
    c.height = 64;
    const g = c.getContext('2d')!;
    const gr = g.createLinearGradient(0, 0, 0, 64);
    gr.addColorStop(0, up ? 'rgba(0,0,0,0)' : 'rgba(0,0,0,1)');
    gr.addColorStop(1, up ? 'rgba(0,0,0,1)' : 'rgba(0,0,0,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 1, 64);
  }

  function dispose() {
    for (const c of [canvas, layer, buf, bg, crustC]) c.width = c.height = 0;
  }

  return {
    resize,
    render,
    dispose,
    layout: (): DawnLayout => ({ W, H, cx, cy, hy, L }),
  };
}

export type Dawn = ReturnType<typeof createDawn>;
