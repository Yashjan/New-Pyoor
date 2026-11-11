'use client';

import type { CSSProperties } from 'react';
import { LIVE, PANORAMA } from './panorama';
import styles from './Journey.module.css';

/*
 * The panorama's living details: small overlays drawn in each layer's plate units, over the
 * still plates. Scroll-linked ones follow the pan (and reverse with it); ambient loops run only
 * while their scene is on screen and the tab is visible. Only transform, opacity and
 * stroke-dashoffset ever change.
 */

type Box = readonly [number, number, number, number];
type Layer = 'sky' | 'far' | 'near';

const D = LIVE as unknown as {
  flow: { s: number; box: Box; d: string[] };
  rings: { s: number; box: Box; o: readonly [number, number]; d: string; hole: Box };
  evap: {
    s: number;
    box: Box;
    dashes: [number, number, number, number][];
    crystals: [number, number, number][];
  };
  rake: {
    s: number;
    box: Box;
    html: string;
    dx: number;
    furrows: [number, number, number, number][];
  };
  shimmer: { s: number; box: Box; paper: string; a: string; b: string };
  glints: { s: number; pts: [number, number, number][] };
  jar: { s: number; box: Box; html: string };
  birds: {
    s: number;
    x: number;
    y: number;
    travel: number;
    scale: number;
    vb: Box;
    flock: [number, number][];
    up: string;
    down: string;
  };
};

const RING_COUNT = 3;
const RING_ORIGIN_Y = 128.1; // the ring's centre, as a share of its arc's height (fill-box)
const BIRD_PAD: readonly [number, number] = [130, 34];
const MOBILE = '(max-width: 699px)';

const phase = (t: number, a: number, b: number) => Math.min(1, Math.max(0, (t - a) / (b - a)));
const ease = (t: number) => t * t * (3 - 2 * t);

/** A tiny 4-point star. */
const star = (x: number, y: number, r: number, waist = 0.28) => {
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
  return `M${p.map((v) => v.map((n) => +n.toFixed(2)).join(' ')).join('L')}Z`;
};

/** Placement, in plate units, for the CSS (motion: × --k; a still frame: in cqh). */
const place = (box: Box, cc?: number): CSSProperties =>
  ({
    '--x': box[0],
    '--y': box[1],
    '--w': box[2],
    '--h': box[3],
    ...(cc === undefined ? {} : { '--cc': cc }),
  }) as CSSProperties;

const svgProps = (box: Box) => ({
  viewBox: box.join(' '),
  fill: 'none',
  stroke: '#a8823f',
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
  focusable: false,
});

/**
 * The overlays of one layer. In motion, every scene's (hidden until the scene has drawn itself);
 * in a still frame (`scene`), that scene's, in their final state and without the ambient loops.
 */
export function LiveLayer({ layer, scene }: { layer: Layer; scene?: number }) {
  const still = scene !== undefined;
  const cc = still ? PANORAMA.layers[layer].centers[scene] : undefined;
  const show = (s: number) => !still || s === scene;
  const cls = `${styles.live}`;
  const out: React.ReactNode[] = [];

  if (layer === 'near') {
    if (show(D.flow.s))
      out.push(
        <svg
          key="flow"
          className={`${cls} ${styles.flow}`}
          data-live="flow"
          data-live-s={D.flow.s}
          style={place(D.flow.box, cc)}
          {...svgProps(D.flow.box)}
        >
          {D.flow.d.map((d) => (
            <path key={d} className="a" d={d} />
          ))}
        </svg>,
      );
    if (!still)
      out.push(
        <svg
          key="rings"
          className={cls}
          data-live="rings"
          data-live-s={D.rings.s}
          style={place(D.rings.box)}
          {...svgProps(D.rings.box)}
        >
          <clipPath id="journey-gate">
            <path
              clipRule="evenodd"
              d={`M${D.rings.box[0]} ${D.rings.box[1]}h${D.rings.box[2]}v${D.rings.box[3]}h${-D.rings.box[2]}Z M${D.rings.hole[0]} ${D.rings.hole[1]}H${D.rings.hole[2]}V${D.rings.hole[3]}H${D.rings.hole[0]}Z`}
            />
          </clipPath>
          <g clipPath="url(#journey-gate)">
            <g transform={`translate(${D.rings.o[0]} ${D.rings.o[1]})`}>
              {Array.from({ length: RING_COUNT }, (_, i) => (
                <path
                  key={i}
                  className={`b ${styles.ring}`}
                  d={D.rings.d}
                  style={{ transformOrigin: `50% ${RING_ORIGIN_Y}%` }}
                />
              ))}
            </g>
          </g>
        </svg>,
      );
    if (show(D.evap.s))
      out.push(
        <svg
          key="evap"
          className={`${cls} ${styles.evap}`}
          data-live="evap"
          data-live-s={D.evap.s}
          style={place(D.evap.box, cc)}
          {...svgProps(D.evap.box)}
        >
          {D.evap.dashes.map(([x, y, l, dy], i) => (
            <path key={`d${i}`} className="a" data-dash="" d={`M${x} ${y}l${l} ${dy}`} />
          ))}
          {D.evap.crystals.map(([x, y, r], i) => (
            <path
              key={`c${i}`}
              className="f"
              data-crystal=""
              data-half={i % 2 ? '' : undefined}
              d={star(x, y, r)}
            />
          ))}
        </svg>,
      );
    // 03: the worker, rake and reflection move as one group; furrows draw out behind the board
    const dx = still ? D.rake.dx : 0;
    if (show(D.rake.s))
      out.push(
        <svg
          key="rake"
          className={cls}
          data-live="rake"
          data-live-s={D.rake.s}
          style={place(D.rake.box, cc)}
          {...svgProps(D.rake.box)}
        >
          {D.rake.furrows.map((f, i) => (
            <path
              key={i}
              className={`b ${styles.furrow}`}
              data-furrow=""
              d={`M${f[0]} ${f[1]}h${f[2]}`}
              strokeDasharray={`${f[2]} ${f[2]}`}
              strokeDashoffset={still ? 0 : f[2]}
            />
          ))}
          <g
            data-move=""
            transform={`translate(${dx} 0)`}
            dangerouslySetInnerHTML={{ __html: D.rake.html }}
          />
        </svg>,
      );
    if (show(D.shimmer.s))
      out.push(
        <div
          key="shimmer"
          className={styles.mover}
          data-mover=""
          style={{ '--dx': dx } as CSSProperties}
        >
          {(['a', 'b'] as const).map((k) => (
            <svg
              key={k}
              className={cls}
              data-live="shimmer"
              data-live-s={D.shimmer.s}
              style={place(D.shimmer.box, cc)}
              {...svgProps(D.shimmer.box)}
            >
              {k === 'a' && <path className="p" d={D.shimmer.paper} />}
              <path className="a" opacity="0.7" d={D.shimmer[k]} />
            </svg>
          ))}
        </div>,
      );
  }

  // 05: the jar, from the 3D model (it glides onto the 3D jar in step 2: Journey.tsx)
  if (layer === 'far' && show(D.jar.s))
    out.push(
      <svg
        key="jar"
        className={`${cls} ${styles.jar}`}
        data-jar=""
        style={place(D.jar.box, cc)}
        {...svgProps(D.jar.box)}
        dangerouslySetInnerHTML={{ __html: D.jar.html }}
      />,
    );

  if (layer === 'far' && !still) {
    D.glints.pts.forEach(([x, y, r], i) => {
      const g = r * 0.5;
      const box: Box = [x - g * 3, y - g * 3, g * 6, g * 6];
      out.push(
        <svg
          key={`glint${i}`}
          className={`${cls} ${styles.glint}`}
          data-live="glint"
          data-live-s={D.glints.s}
          data-half={i % 2 ? '' : undefined}
          style={place(box)}
          {...svgProps(box)}
        >
          <path className="f" d={star(x, y, g, 0.2)} />
          <path
            className={styles.hair}
            d={`M${x - g * 2} ${y}h${g * 4}M${x} ${y - g * 2.8}v${g * 5.6}`}
          />
        </svg>,
      );
    });
    const B = D.birds;
    const box: Box = [
      B.x - BIRD_PAD[0],
      B.y - BIRD_PAD[1],
      B.travel + BIRD_PAD[0] * 2,
      BIRD_PAD[1] * 2,
    ];
    const vb = B.vb;
    out.push(
      <div key="birds" className={cls} data-live="birds" data-live-s={B.s} style={place(box)}>
        <div className={styles.flock} data-flock="">
          {B.flock.map(([dx, dy], i) => {
            const bb: Box = [
              BIRD_PAD[0] + dx + vb[0] * B.scale,
              BIRD_PAD[1] + dy + vb[1] * B.scale,
              vb[2] * B.scale,
              vb[3] * B.scale,
            ];
            return (
              <div
                key={i}
                className={styles.live}
                data-bird=""
                data-half={i % 2 ? '' : undefined}
                style={place(bb)}
              >
                {(['up', 'down'] as const).map((f) => (
                  <svg
                    key={f}
                    className={styles.wing}
                    data-wing={f}
                    {...svgProps(vb)}
                    dangerouslySetInnerHTML={{ __html: B[f] }}
                  />
                ))}
              </div>
            );
          })}
        </div>
      </div>,
    );
  }
  return out.length ? <>{out}</> : null;
}

/**
 * Drives the overlays inside the motion panorama: `scroll(pan)` from the render loop,
 * `reveal(scene, delay)` once a scene has drawn itself, `active(on)` while the panorama shows.
 */
export function createLiving(journey: HTMLElement) {
  // the motion panorama's overlays only, not the still frames' copies
  const root = journey.querySelector<HTMLElement>('[data-veil]') ?? journey;
  const q = <T extends Element>(s: string) => [...root.querySelectorAll<T>(s)];
  const half = () => window.matchMedia(MOBILE).matches;
  const live = q<SVGSVGElement | HTMLElement>('[data-live]');
  const flow = root.querySelector<SVGSVGElement>('[data-live="flow"]');
  const dashes = q<SVGPathElement>('[data-dash]');
  const crystals = q<SVGPathElement>('[data-crystal]');
  const furrows = q<SVGPathElement>('[data-furrow]');
  const moveEl = root.querySelector<SVGGElement>('[data-move]');
  const mover = root.querySelector<HTMLElement>('[data-mover]');
  const k = () => Number(getComputedStyle(journey).getPropertyValue('--k')) || 1;

  const revealed = [false, false, false, false, false];
  const timers = new Set<number>();
  const later = (fn: () => void, ms: number) => {
    const t = window.setTimeout(() => {
      timers.delete(t);
      fn();
    }, ms);
    timers.add(t);
    return t;
  };

  /* ---------- scroll-linked ---------- */
  const last = { flow: NaN, evap: NaN, rake: NaN };
  const ex = D.evap.box[0];
  const ew = D.evap.box[2];
  const shown = new Map<Element, string>();
  const set = (el: Element & ElementCSSInlineStyle, transform: string, opacity: string) => {
    const key = transform + opacity;
    if (shown.get(el) === key) return;
    shown.set(el, key);
    el.style.transform = transform;
    el.style.opacity = opacity;
  };

  const scroll = (pan: number) => {
    // 01: the water slides through the sluice towards the pans
    const off = +(-pan * 280).toFixed(1);
    if (flow && off !== last.flow) {
      last.flow = off;
      flow.style.setProperty('--off', String(off));
    }
    // 02: dashes shorten and thin out, left to right across the scene; crystals appear
    const ev = +phase(pan, 0.05, 0.45).toFixed(3);
    if (ev !== last.evap) {
      last.evap = ev;
      dashes.forEach((el, i) => {
        const u = (D.evap.dashes[i]![0] - ex) / ew;
        const e = phase(ev, u * 0.6, u * 0.6 + 0.4);
        set(el, `scaleX(${(1 - 0.85 * e).toFixed(3)})`, (1 - e).toFixed(3));
        const c = ease(phase(e, 0.5, 1));
        set(crystals[i]!, `scale(${(0.3 + 0.7 * c).toFixed(3)})`, c.toFixed(3));
      });
    }
    // 03: the worker, rake and reflection come forward 15% of the pan; furrows draw out behind
    const rp = +ease(phase(pan, 0.36, 0.64)).toFixed(4);
    if (rp !== last.rake && moveEl) {
      last.rake = rp;
      const dx = D.rake.dx * rp;
      moveEl.setAttribute('transform', `translate(${dx.toFixed(2)} 0)`);
      mover?.style.setProperty('--dx', dx.toFixed(2));
      furrows.forEach((el, i) => {
        el.style.strokeDashoffset = (D.rake.furrows[i]![2] * (1 - rp)).toFixed(2);
      });
    }
  };

  /* ---------- ambient loops ---------- */
  type Loop = {
    el: Element;
    scene: number;
    inView: boolean;
    fresh: boolean;
    running: boolean;
    play: (fresh: boolean) => void;
    pause: () => void;
  };
  const loops: Loop[] = [];
  const loop = (el: Element | null, scene: number, play: Loop['play'], pause: Loop['pause']) => {
    if (el) loops.push({ el, scene, inView: false, fresh: true, running: false, play, pause });
  };

  // 01: a ripple ring leaves the gate every 3 s, widening and fading
  const rings = q<SVGPathElement>('[data-live="rings"] path[class]');
  let ringAnims: Animation[] = [];
  loop(
    root.querySelector('[data-live="rings"]'),
    D.rings.s,
    () => {
      if (!ringAnims.length)
        ringAnims = rings.map((el, i) =>
          el.animate(
            [
              { transform: 'scale(0.3)', opacity: 0 },
              { opacity: 0.85, offset: 0.15 },
              { transform: 'scale(1)', opacity: 0 },
            ],
            { duration: 9000, delay: i * 3000, iterations: Infinity, easing: 'ease-out' },
          ),
        );
      ringAnims.forEach((a) => a.play());
    },
    () => ringAnims.forEach((a) => a.pause()),
  );

  // 03: the reflection's two sets of rows drift against each other, 4 s
  const shimmer = q<SVGSVGElement>('[data-live="shimmer"]');
  let shimmerAnims: Animation[] = [];
  loop(
    shimmer[0] ?? null,
    D.shimmer.s,
    () => {
      if (!shimmerAnims.length) {
        const u = k() * 1.4;
        shimmerAnims = shimmer.map((el, i) => {
          const s = i ? -1 : 1;
          return el.animate(
            [
              { transform: 'translateX(0)' },
              { transform: `translateX(${(s * u).toFixed(2)}px)` },
              { transform: `translateX(${(-s * u * 0.6).toFixed(2)}px)` },
              { transform: 'translateX(0)' },
            ],
            { duration: 4000, iterations: Infinity, easing: 'ease-in-out' },
          );
        });
      }
      shimmerAnims.forEach((a) => a.play());
    },
    () => shimmerAnims.forEach((a) => a.pause()),
  );

  // 05: glints on the heap, each fading in and out on its own, 2-4 s
  const glints = q<SVGSVGElement>('[data-live="glint"]');
  const glintState = new Map<Element, { anim?: Animation; timer?: number }>();
  let glintsOn = false;
  const glint = (el: SVGSVGElement) => {
    const st = glintState.get(el) ?? {};
    glintState.set(el, st);
    st.timer = later(
      () => {
        if (!glintsOn) return;
        st.anim = el.animate(
          [
            { opacity: 0, transform: 'scale(0.6)' },
            { opacity: 1, transform: 'scale(1)' },
            { opacity: 0, transform: 'scale(1)' },
          ],
          {
            duration: 2000 + Math.random() * 2000,
            easing: 'ease-in-out',
          },
        );
        st.anim.onfinish = () => {
          st.anim = undefined;
          if (glintsOn) glint(el);
        };
      },
      300 + Math.random() * 2600,
    );
  };
  loop(
    glints[0] ?? null,
    D.glints.s,
    () => {
      glintsOn = true;
      const mine = half() ? glints.filter((g) => !g.hasAttribute('data-half')) : glints;
      mine.forEach((el) => {
        const st = glintState.get(el);
        if (st?.anim) st.anim.play();
        else if (!st?.timer || !timers.has(st.timer)) glint(el);
      });
    },
    () => {
      glintsOn = false;
      glintState.forEach((st) => {
        st.anim?.pause();
        if (st.timer) {
          clearTimeout(st.timer);
          timers.delete(st.timer);
          st.timer = undefined;
        }
      });
    },
  );

  // 01: flamingos crossing the dawn sky, slowly, once per visit
  const birdsEl = root.querySelector<HTMLElement>('[data-live="birds"]');
  const flock = birdsEl?.querySelector<HTMLElement>('[data-flock]') ?? null;
  let pass: Animation | undefined;
  let wings: Animation[] = [];
  loop(
    birdsEl,
    D.birds.s,
    (fresh) => {
      if (!flock) return;
      if (fresh || !pass) {
        pass?.cancel();
        wings.forEach((a) => a.cancel());
        const birds = [...flock.querySelectorAll<HTMLElement>('[data-bird]')].filter(
          (b) => !half() || !b.hasAttribute('data-half'),
        );
        const u = k();
        if (half()) {
          // Phones: a narrow view, so the flock starts inside it (the first bird ~15% from the
          // left, as scene 01 is centred), 1.4x larger, and crosses in about 8 s.
          const vw = journey.clientWidth;
          const lead = PANORAMA.layers.far.centers[0] - vw / (2 * u) + (0.15 * vw) / u;
          const from = (lead - D.birds.x) * u;
          const to = from + 0.85 * vw + 60 * u;
          flock.style.transformOrigin = `${BIRD_PAD[0] * u}px ${BIRD_PAD[1] * u}px`;
          pass = flock.animate(
            [
              { transform: `translateX(${from.toFixed(1)}px) scale(1.4)`, opacity: 0 },
              { opacity: 1, offset: 0.06 },
              { opacity: 1, offset: 0.9 },
              { transform: `translateX(${to.toFixed(1)}px) scale(1.4)`, opacity: 0 },
            ],
            { duration: 8000, easing: 'linear', fill: 'forwards' },
          );
        } else {
          flock.style.removeProperty('transform-origin');
          pass = flock.animate(
            [
              { transform: 'translateX(0)', opacity: 0 },
              { opacity: 1, offset: 0.08 },
              { opacity: 1, offset: 0.9 },
              { transform: `translateX(${(D.birds.travel * u).toFixed(1)}px)`, opacity: 0 },
            ],
            { duration: 34000, easing: 'linear', fill: 'forwards' },
          );
        }
        // one beat ~1.2 s: wings up, then down (two drawings), each bird out of step
        wings = birds.flatMap((b) => {
          const period = 1100 + Math.random() * 300;
          const delay = -Math.random() * period;
          return [...b.querySelectorAll<SVGSVGElement>('[data-wing]')].map((w, j) =>
            w.animate(
              j === 0
                ? [
                    { opacity: 1 },
                    { opacity: 1, offset: 0.5 },
                    { opacity: 0, offset: 0.5 },
                    { opacity: 0 },
                  ]
                : [
                    { opacity: 0 },
                    { opacity: 0, offset: 0.5 },
                    { opacity: 1, offset: 0.5 },
                    { opacity: 1 },
                  ],
              { duration: period, delay, iterations: Infinity },
            ),
          );
        });
        pass.onfinish = () => wings.forEach((a) => a.pause());
        return;
      }
      if (pass.playState !== 'finished') {
        pass.play();
        wings.forEach((a) => a.play());
      }
    },
    () => {
      if (pass?.playState === 'running') pass.pause();
      wings.forEach((a) => a.pause());
    },
  );

  let on = false;
  const update = () => {
    const visible = document.visibilityState === 'visible';
    for (const l of loops) {
      const want = on && visible && revealed[l.scene]! && l.inView;
      if (want && !l.running) {
        l.running = true;
        l.play(l.fresh);
        l.fresh = false;
      } else if (!want && l.running) {
        l.running = false;
        l.pause();
      }
    }
  };

  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      const l = loops.find((x) => x.el === e.target);
      if (!l) continue;
      if (!e.isIntersecting && l.inView) l.fresh = true; // the next time it shows is a new visit
      l.inView = e.isIntersecting;
    }
    update();
  });
  loops.forEach((l) => io.observe(l.el));
  document.addEventListener('visibilitychange', update);

  return {
    scroll,
    /** A scene's details appear once its strokes have drawn themselves. */
    reveal(scene: number, delay: number) {
      later(() => {
        live.forEach((el) => {
          if (Number(el.getAttribute('data-live-s')) === scene) el.style.visibility = 'inherit'; // and hidden with the panorama
        });
        revealed[scene] = true;
        update();
      }, delay);
    },
    active(value: boolean) {
      if (value === on) return;
      on = value;
      if (!on) loops.forEach((l) => (l.fresh = true));
      update();
    },
    destroy() {
      on = false;
      update();
      io.disconnect();
      document.removeEventListener('visibilitychange', update);
      timers.forEach((t) => clearTimeout(t));
      [...ringAnims, ...shimmerAnims, ...wings].forEach((a) => a.cancel());
      pass?.cancel();
      glintState.forEach((st) => st.anim?.cancel());
    },
  };
}
