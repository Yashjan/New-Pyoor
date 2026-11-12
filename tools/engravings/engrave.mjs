// Journey engravings: the etching toolkit. Plain SVG strokes, no fills.
// Foreground goes in first: everything added later is cut geometrically by earlier occluders,
// so a hidden line really does not exist, in the finished plate and while it draws itself.
import { statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const here = dirname(fileURLToPath(import.meta.url));
export { statSync, writeFileSync, join };
export const W = 640;
export const H = 512;

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
export const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
export const lerp = (a, b, t) => a + (b - a) * t;
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));

/** Catmull-Rom through hand-placed points, sampled every ~step px. */
export function curve(pts, closed = false, step = 2.5) {
  const n = pts.length;
  const out = [];
  const get = (i) => (closed ? pts[(i + n) % n] : pts[clamp(i, 0, n - 1)]);
  const last = closed ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const p0 = get(i - 1);
    const p1 = get(i);
    const p2 = get(i + 1);
    const p3 = get(i + 2);
    const k = Math.max(2, Math.ceil(dist(p1, p2) / step));
    for (let j = 0; j < k; j++) {
      const t = j / k;
      const t2 = t * t;
      const t3 = t2 * t;
      const f = (a, b, c, d) =>
        0.5 *
        (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (3 * b - a - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  out.push(closed ? out[0].slice() : pts[n - 1].slice());
  return out;
}

function resample(poly, step = 1.2) {
  const out = [poly[0].slice()];
  for (let i = 1; i < poly.length; i++) {
    const a = poly[i - 1];
    const b = poly[i];
    const k = Math.max(1, Math.ceil(dist(a, b) / step));
    for (let j = 1; j <= k; j++) out.push([lerp(a[0], b[0], j / k), lerp(a[1], b[1], j / k)]);
  }
  return out;
}

export function inside(poly, p) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (
      a[1] > p[1] !== b[1] > p[1] &&
      p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]
    )
      c = !c;
  }
  return c;
}

function simplify(p, e = 0.3) {
  if (p.length < 3) return p;
  const a = p[0];
  const b = p[p.length - 1];
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const L = Math.hypot(dx, dy) || 1;
  let m = 0;
  let k = 0;
  for (let i = 1; i < p.length - 1; i++) {
    const d = Math.abs(dy * p[i][0] - dx * p[i][1] + b[0] * a[1] - b[1] * a[0]) / L;
    if (d > m) {
      m = d;
      k = i;
    }
  }
  return m > e
    ? [...simplify(p.slice(0, k + 1), e).slice(0, -1), ...simplify(p.slice(k), e)]
    : [a, b];
}

const num = (v) => String(v).replace(/^0\./, '.').replace(/^-0\./, '-.');
const glue = (a) => a.reduce((s, x, i) => s + (i && x[0] !== '-' ? ' ' : '') + x, '');
/** prec: 1 whole units, 2 halves, 10 tenths */
function pathD(p, prec = 10) {
  const r = (v) => Math.round(v * prec) / prec;
  let px = r(p[0][0]);
  let py = r(p[0][1]);
  const v = [];
  for (let i = 1; i < p.length; i++) {
    const x = r(p[i][0]);
    const y = r(p[i][1]);
    v.push(num(+(x - px).toFixed(1)), num(+(y - py).toFixed(1)));
    px = x;
    py = y;
  }
  return 'M' + glue([num(px === p[0][0] ? px : r(p[0][0])), num(r(p[0][1]))]) + 'l' + glue(v);
}
const lenOf = (p) => p.reduce((s, q, i) => (i ? s + dist(p[i - 1], q) : 0), 0);

/** The five burin weights, in CSS px. */
const WEIGHTS = [0.5, 0.75, 1, 1.25, 1.4];
const CLS = { 0.5: 'a', 0.75: '', 1: 'b', 1.25: 'c', 1.4: 'd' };
const snap = (w) => WEIGHTS.reduce((m, x) => (Math.abs(x - w) < Math.abs(m - w) ? x : m), 0.75);

export function Plate(seed, { vignette = true, width = W } = {}) {
  const rnd = RNG(seed);
  const items = [];
  const occ = [];
  const strokes = [];
  let curS = null; // the scene the next strokes belong to
  let region = null; // only strokes inside this are kept
  const pushItem = (o) => items.push({ s: curS, ...o });
  const pushStroke = (o) => strokes.push({ s: curS, ...o });
  const out = (q) => {
    if (!vignette) return q[0] < 0 || q[0] > width || q[1] < 1 || q[1] > H - 1;
    if (q[0] < 12 || q[0] > 628 || q[1] < 8 || q[1] > 506) return true;
    // an uneven edge, as where an etcher's lines give out
    const dx = Math.abs(q[0] - 320) / (296 + 11 * Math.sin(q[1] * 1.7) + 7 * Math.sin(q[1] * 0.53));
    const dy = Math.abs(q[1] - 256) / 262;
    return dx ** 2.8 + dy ** 2.8 > 1;
  };
  const hidden = (q) => out(q) || (region && !region(q)) || occ.some((o) => inside(o, q));
  const cut = (poly) => {
    const runs = [];
    let run = [];
    for (const q of resample(poly)) {
      if (hidden(q)) {
        if (run.length > 1) runs.push(run);
        run = [];
      } else run.push(q);
    }
    if (run.length > 1) runs.push(run);
    return runs;
  };
  const wob = (poly, amp) => {
    if (!amp) return poly;
    const f1 = 0.018 + rnd() * 0.02;
    const f2 = 0.07 + rnd() * 0.05;
    const a = rnd() * 6;
    const b = rnd() * 6;
    const c = rnd() * 6;
    const e = rnd() * 6;
    let s = 0;
    return poly.map((q, i) => {
      if (i) s += dist(poly[i - 1], q);
      return [
        q[0] + amp * (Math.sin(s * f1 + a) + 0.45 * Math.sin(s * f2 + b)),
        q[1] + amp * (Math.sin(s * f1 + c) + 0.45 * Math.sin(s * f2 + e)),
      ];
    });
  };

  /** A run of points as swelling pieces: thin at free ends, heavier on the shadow side. */
  const emit = (run, { w, t, opacity, taper, swell }) => {
    const L = lenOf(run);
    if (L < 2) return;
    if (!taper || L < 14) {
      pushItem({ d: pathD(simplify(run), L > 60 ? 2 : 10), w: snap(w), t, opacity });
      return;
    }
    const reach = Math.min(L * 0.3, 34);
    let s = 0;
    const weightAt = (i) => {
      if (i) s += dist(run[i - 1], run[i]);
      let k = 1;
      if (taper === 'ends') {
        const e = clamp(Math.min(s, L - s) / reach);
        k = 0.42 + 0.58 * e * e * (3 - 2 * e);
      }
      if (swell) {
        const a = run[Math.max(0, i - 2)];
        const b = run[Math.min(run.length - 1, i + 2)];
        const dx = b[0] - a[0];
        const dy = b[1] - a[1];
        const m = Math.hypot(dx, dy) || 1;
        // the outline's normal against the light, which comes from the upper left
        k *= 0.92 + 0.34 * Math.abs((dy / m) * 0.75 + (-dx / m) * 0.35);
      }
      return snap(w * k);
    };
    let piece = [run[0]];
    let cur = weightAt(0);
    for (let i = 1; i < run.length; i++) {
      const v = weightAt(i);
      piece.push(run[i]);
      if (v !== cur && lenOf(piece) > 13) {
        pushItem({ d: pathD(simplify(piece), L > 60 ? 2 : 10), w: cur, t, opacity });
        piece = [run[i]];
        cur = v;
      }
    }
    if (piece.length > 1)
      pushItem({ d: pathD(simplify(piece), L > 60 ? 2 : 10), w: cur, t, opacity });
  };

  const api = {
    rnd,
    /** a burin stroke: free ends step down to the finest weight */
    line(poly, { w = 1, t = 5, amp = 0.3, opacity, taper = 'ends', swell = false } = {}) {
      for (const run of cut(wob(poly, amp))) emit(run, { w, t, opacity, taper, swell });
    },
    curve(pts, o = {}) {
      api.line(curve(pts, false), o);
    },
    /** a closed outline, heavier on its shadow side */
    shape(pts, o = {}) {
      const p = curve(pts, true);
      api.line(p, { taper: 'swell', swell: true, ...o });
      return p;
    },
    block(p) {
      occ.push(p);
    },
    /** how many shapes block what's drawn next; `release(n)` forgets those added since */
    blocks() {
      return occ.length;
    },
    release(n) {
      occ.length = n;
    },
    /** very straight, very cheap strokes: merged into shared paths */
    rule(a, b, { w = 0.5, t = 7, opacity, prec = 1 } = {}) {
      for (const run of cut([a, b]))
        if (lenOf(run) > 2) pushStroke({ a: run[0], b: run[run.length - 1], w, t, opacity, prec });
    },
    /** parallel engraving lines; `over` swells the middle of each line where shadow is deepest */
    hatch(
      poly,
      {
        angle = 45,
        gap = 2.4,
        w = 0.5,
        t = 6,
        shade = () => 1,
        jitter = 0.35,
        opacity,
        max = 1e9,
        over,
        shared,
      } = {},
    ) {
      const rad = (angle * Math.PI) / 180;
      const cs = Math.cos(rad);
      const sn = Math.sin(rad);
      const rot = poly.map(([x, y]) => [x * cs + y * sn, -x * sn + y * cs]);
      const ys = rot.map((q) => q[1]);
      const y0 = Math.min(...ys);
      const y1 = Math.max(...ys);
      const segs = [];
      const thick = [];
      const push = (run) => {
        if (dist(run[0], run[1]) <= 2.5) return;
        segs.push(run);
        if (over && dist(run[0], run[1]) > 9) {
          const m = [(run[0][0] + run[1][0]) / 2, (run[0][1] + run[1][1]) / 2];
          if (over(m[0], m[1])) {
            const a = [lerp(run[0][0], run[1][0], 0.24), lerp(run[0][1], run[1][1], 0.24)];
            const b = [lerp(run[0][0], run[1][0], 0.76), lerp(run[0][1], run[1][1], 0.76)];
            thick.push([a, b]);
          }
        }
      };
      for (let y = y0 + gap * rnd(); y < y1; y += gap * (1 - jitter * 0.4 + rnd() * jitter * 0.8)) {
        const xs = [];
        for (let i = 0, j = rot.length - 1; i < rot.length; j = i++) {
          const p = rot[i];
          const q = rot[j];
          if (p[1] > y !== q[1] > y) xs.push(p[0] + ((y - p[1]) / (q[1] - p[1])) * (q[0] - p[0]));
        }
        xs.sort((u, v) => u - v);
        for (let k = 0; k + 1 < xs.length; k += 2) {
          let run = null;
          let limit = max * (0.3 + rnd() * 1.1);
          const tilt = (rnd() - 0.5) * 0.02;
          for (let x = xs[k] + rnd(); x <= xs[k + 1] - rnd(); x += 1.5) {
            const yy = y + (x - xs[k]) * tilt;
            const wx = x * cs - yy * sn;
            const wy = x * sn + yy * cs;
            const on = shade(wx, wy) > 0.16 + rnd() * 0.1 && !hidden([wx, wy]);
            if (on) {
              if (!run)
                run = [
                  [wx, wy],
                  [wx, wy],
                ];
              else run[1] = [wx, wy];
            } else if (run) {
              push(run);
              run = null;
            }
            // broken at a different place on every line, so no vertical seams appear
            if (run && dist(run[0], run[1]) > limit) {
              push(run);
              run = null;
              limit = max * (0.55 + rnd() * 0.9);
            }
          }
          if (run) push(run);
        }
      }
      const add = (list, weight) => {
        if (list.length)
          pushItem({
            d: list.map((q) => pathD(q, 2)).join(''),
            w: weight,
            t,
            opacity,
            m: Math.ceil(Math.max(...list.map(lenOf))) + 1,
          });
      };
      if (shared) for (const q of segs) pushStroke({ a: q[0], b: q[1], w, t, opacity, prec: 1 });
      else add(segs, w);
      add(thick, 0.75);
    },
    /** short level water strokes, swelling in the middle near the viewer */
    ripple(x0, x1, y, { w = 0.5, t = 7, opacity, seg = 30, swell = false } = {}) {
      let x = x0 + rnd() * seg * 0.4;
      while (x < x1) {
        const L = seg * (0.4 + rnd() * 0.9);
        const e = Math.min(x1, x + L);
        const y2 = y + (rnd() - 0.5) * 0.8;
        for (const run of cut([
          [x, y],
          [e, y2],
        ])) {
          if (lenOf(run) <= 2) continue;
          const a = run[0];
          const b = run[run.length - 1];
          pushStroke({ a, b, w, t, opacity, prec: 1 });
          if (swell && dist(a, b) > 12) {
            const c = [lerp(a[0], b[0], 0.3), lerp(a[1], b[1], 0.3)];
            const d = [lerp(a[0], b[0], 0.7), lerp(a[1], b[1], 0.7)];
            pushStroke({ a: c, b: d, w: 0.75, t, opacity, prec: 1 });
          }
        }
        x = e + seg * (0.14 + rnd() * 0.5);
      }
    },
    /** the scene the following strokes belong to (grouped for the draw-in) */
    at(s) {
      curS = s;
    },
    /** keep only what passes this test (each scene's block of pans), or null for everything */
    within(fn) {
      region = fn;
    },
    /** an invisible paper-coloured shape: hides other layers' lines behind this object */
    paper(poly) {
      // simplified open: a closed ring's ends coincide, which would collapse it to a point
      const same = dist(poly[0], poly[poly.length - 1]) < 0.01;
      const ring = simplify(same ? poly.slice(0, -1) : poly, 0.6);
      pushItem({ d: pathD(ring, 2) + 'z', w: 0.75, t: -1, paper: true });
    },
    svg(style = '') {
      const buckets = new Map();
      for (const k of strokes) {
        const key = `${k.s}|${k.w}|${k.t}|${k.opacity ?? ''}|${k.prec}`;
        if (!buckets.has(key)) buckets.set(key, { ...k, list: [] });
        buckets.get(key).list.push(k);
      }
      for (const b of buckets.values()) {
        b.list.sort((u, v) => u.a[1] - v.a[1]);
        pushItem({
          s: b.s,
          d: b.list.map((k) => pathD([k.a, k.b], b.prec)).join(''),
          w: b.w,
          t: b.t,
          opacity: b.opacity,
          m: Math.ceil(Math.max(...b.list.map((k) => dist(k.a, k.b)))) + 1,
        });
      }
      items.sort((a, b) => a.t - b.t);
      const one = (i) => {
        const c = CLS[i.w];
        if (i.paper) return `<path class="p" d="${i.d}"/>`;
        return `<path${c ? ` class="${c}"` : ''} d="${i.d}"${i.m ? ` data-m="${i.m}"` : ''} data-t="${i.t}"${i.opacity ? ` opacity="${i.opacity}"` : ''}/>`;
      };
      const scenes = [...new Set(items.map((i) => i.s))];
      const body =
        scenes.length === 1 && scenes[0] === null
          ? items.map(one).join('')
          : scenes
              .map(
                (s) =>
                  `<g data-s="${s}">${items
                    .filter((i) => i.s === s)
                    .map(one)
                    .join('')}</g>`,
              )
              .join('');
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${H}" fill="none" stroke="#a8823f" stroke-linecap="round" stroke-linejoin="round">${style}${body}</svg>`;
    },
  };
  return api;
}

export const rect = (x0, y0, x1, y1) => [
  [x0, y0],
  [x1, y0],
  [x1, y1],
  [x0, y1],
  [x0, y0],
];
