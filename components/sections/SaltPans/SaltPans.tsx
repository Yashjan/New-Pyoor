'use client';

import { useEffect, useRef } from 'react';
import { asset } from '@/lib/basePath';
import { loadGsap } from '@/lib/motion/gsap';
import { coveredStore } from '@/lib/motion/covered';
import { HORIZON_AT, PANS, PANS_VH, clamp01, power2InOut, span } from '@/lib/motion/pans';
import { pickQualityTier } from '@/lib/three/quality';
import styles from './SaltPans.module.css';

/** Portrait screens get the narrower field (the hero's own portrait test: w / h < 0.9). */
const PORTRAIT = '(max-aspect-ratio: 9 / 10)';
/** When each engraving stage starts (fractions of step 3), and how long one ring takes. */
const STAGE_AT: Record<string, number> = { 1: 0.15, 2: 0.185, 3: 0.235, 4: 0.28, 5: 0.32, 6: 0.35 };
const RING_STEP = 0.012;
const DRAW = 0.05;

const smooth = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const q3 = (v: number) => Math.round(v * 1000) / 1000;

interface Stroke {
  el: SVGPathElement;
  m: number;
}
interface Group {
  el: SVGGElement;
  at: number;
  dur: number;
  strokes: Stroke[];
  u: number;
}
interface Band {
  el: SVGRectElement;
  d: number;
  u: number;
}
interface Pan {
  o: number;
  water: Band;
  pink: Band | null;
  crust: { el: SVGPathElement; s0: number; c: [number, number]; u: number } | null;
}
interface Art {
  svg: SVGSVGElement;
  vbW: number;
  hz: number;
  settle: [number, number, number, number];
  cam: SVGGElement;
  colour: SVGGElement;
  horizon: SVGPathElement;
  groups: Group[];
  pans: Pan[];
  glints: { el: SVGGElement; o: number; v: number }[];
}

/** Reads the inlined drawing once: everything the scrub touches, and its geometry. */
function readArt(svg: SVGSVGElement, low: boolean): Art {
  const vb = svg.viewBox.baseVal;
  const groups: Group[] = [];
  svg.querySelectorAll<SVGGElement>('[data-lines] g[data-s]').forEach((el) => {
    const [stage = '6', ring = '0', fig] = (el.dataset.s ?? '').split('.');
    if (fig) el.setAttribute('data-fig', fig.slice(1));
    const strokes = [...el.querySelectorAll<SVGPathElement>('path:not(.p)')].map((p) => ({
      el: p,
      m: Number(p.dataset.m) || Math.ceil(p.getTotalLength()) + 1,
    }));
    groups.push({
      el,
      at: (STAGE_AT[stage] ?? 0.35) + Number(ring) * RING_STEP,
      dur: stage === '6' ? DRAW * 1.1 : DRAW,
      strokes,
      u: -1,
    });
  });
  const band = (el: SVGRectElement | null): Band | null =>
    el ? { el, d: Number(el.dataset.d), u: -1 } : null;
  const pans: Pan[] = [];
  svg.querySelectorAll<SVGGElement>('.pn').forEach((g) => {
    if (low && g.hasAttribute('data-x')) {
      g.style.display = 'none'; // low tier: the outer pans stay uncoloured
      return;
    }
    const cr = g.querySelector<SVGPathElement>('.cr');
    const [cx = 0, cy = 0] = (cr?.dataset.c ?? '').split(' ').map(Number);
    pans.push({
      o: Number(g.dataset.o),
      water: band(g.querySelector('.w'))!,
      pink: band(g.querySelector('.k, .kd')),
      crust: cr ? { el: cr, s0: Number(cr.dataset.s0), c: [cx, cy], u: -1 } : null,
    });
  });
  const settle = (svg.dataset.settle ?? '0 0 1 1').split(' ').map(Number) as Art['settle'];
  return {
    svg,
    vbW: vb.width,
    hz: Number(svg.dataset.hz),
    settle,
    cam: svg.querySelector('[data-cam]')!,
    colour: svg.querySelector('[data-colour]')!,
    horizon: svg.querySelector('.hz')!,
    groups,
    pans,
    glints: [...svg.querySelectorAll<SVGGElement>('.gl')].map((el) => ({
      el,
      o: Number(el.dataset.o),
      v: -1,
    })),
  };
}

/** 0–1 of a stroke group drawn: dash offsets while it draws, solid once done, hidden before. */
function drawGroup(g: Group, u: number) {
  if (u === g.u) return;
  const was = g.u;
  g.u = u;
  if (u <= 0) {
    g.el.style.visibility = 'hidden';
    return;
  }
  if (was <= 0) g.el.style.removeProperty('visibility');
  for (const s of g.strokes) {
    if (u >= 1) {
      s.el.style.removeProperty('stroke-dasharray'); // solid again: cheaper to paint
      s.el.style.removeProperty('stroke-dashoffset');
    } else {
      s.el.style.strokeDasharray = `${s.m} ${s.m * 2}`;
      s.el.style.strokeDashoffset = (s.m * (1 - u)).toFixed(1);
    }
  }
}

function setBand(b: Band, u: number) {
  if (u === b.u) return;
  b.u = u;
  b.el.style.transform = `translate(${(b.d * u).toFixed(1)}px,0)`;
}

/**
 * Step 3: the pink salt pans (lib/motion/pans.ts). A layer of the hero's pinned stage for its
 * last PANS_VH: after the 3D camera's rise hands its gold horizon over, the pan field engraves
 * itself, fills with brine that turns pink, grows its white crust, and the camera settles into
 * one pan as the pink softens to ivory. One scrubbed timeline, created at mount; it only writes
 * its own elements. Under reduced motion (or without JS) it is one still: the coloured field and
 * the line, below the hero's beats.
 */
export function SaltPans() {
  const rootRef = useRef<HTMLDivElement>(null);
  const artRef = useRef<HTMLDivElement>(null);
  const lineRef = useRef<HTMLParagraphElement>(null);
  const paperRef = useRef<HTMLDivElement>(null);
  const ruleRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const host = artRef.current;
    const line = lineRef.current;
    const paper = paperRef.current;
    const rule = ruleRef.current;
    if (!root || !host || !line || !paper || !rule) return;
    if (!document.documentElement.classList.contains('motion')) return;

    const low = pickQualityTier()?.name === 'weak';
    if (low) root.setAttribute('data-lo', '');
    const controller = new AbortController();
    const portrait = window.matchMedia(PORTRAIT);
    let art: Art | null = null;
    let q = 0;
    let shown = false;
    let size = { w: 1, h: 1 };
    const last = { paper: -1, hz: -1, line: -1, colour: -1, cam: '', fade: -1, rule: -1 };

    /** The whole scene at q (0–1). Only writes what changed; reads no layout. */
    const render = () => {
      root.dataset.progress = q.toFixed(4);
      const on = q > 0.1 && q < 1;
      if (on !== shown) {
        shown = on;
        root.style.visibility = on ? 'visible' : 'hidden';
      }
      updateLive();
      if (!on || !art) return;
      const a = art;

      // the paper comes in as the 3D canvas fades (the rise's last quarter: .15–.20)
      const pp = q3(smooth(0.15, 0.2, q));
      if (pp !== last.paper) paper.style.opacity = String((last.paper = pp));
      // the far edge: on the 3D horizon line just before the canvas fades
      const hz = q3(smooth(0.125, 0.15, q));
      if (hz !== last.hz) a.horizon.style.opacity = String((last.hz = hz));

      for (const g of a.groups) drawGroup(g, q3(clamp01((q - g.at) / g.dur)));

      // colour: each pan in turn, from the canal outwards; the water spreads in from the inlet,
      // the pink follows it across (its long soft front is the blush)
      for (const p of a.pans) {
        const w0 = PANS.colour[0] + p.o * 0.2;
        setBand(p.water, q3(power2InOut(clamp01((q - w0) / 0.07))));
        if (p.pink) setBand(p.pink, q3(power2InOut(clamp01((q - w0 - 0.04) / 0.1))));
        const c = p.crust;
        if (c) {
          const u = q3(clamp01((q - (PANS.crystals[0] + p.o * 0.16)) / 0.08));
          if (u !== c.u) {
            c.u = u;
            if (u <= 0) c.el.style.visibility = 'hidden';
            else {
              const s = c.s0 + (1 - c.s0) * (1 - Math.pow(1 - u, 3)); // grows inwards
              c.el.style.visibility = '';
              c.el.style.transform = `matrix(${s},0,0,${s},${(c.c[0] * (1 - s)).toFixed(2)},${(c.c[1] * (1 - s)).toFixed(2)})`;
            }
          }
        }
      }
      // glints, a few at a time: a flash that settles to a glimmer
      for (const g of a.glints) {
        const u = clamp01((q - (PANS.crystals[0] + 0.03 + g.o * 0.2)) / 0.05);
        const v = q3(u <= 0 ? 0 : u < 0.5 ? smooth(0, 0.5, u) : 1 - 0.4 * smooth(0.5, 1, u));
        if (v !== g.v) g.el.style.opacity = String((g.v = v));
      }

      // the line: in, held, out as the camera settles
      const lv = q3(smooth(0.6, 0.66, q) * (1 - smooth(0.85, 0.91, q)));
      if (lv !== last.line) {
        last.line = lv;
        line.style.opacity = String(lv);
        line.style.transform = `translateY(${(14 * (1 - smooth(0.6, 0.66, q))).toFixed(1)}px)`;
      }

      // settle: down into one pan (a glide and a zoom about it), the pink softening to ivory,
      // then the lines; the gold rule of the next section draws in at the very end
      const e = power2InOut(span(q, PANS.settle));
      const { w, h } = size;
      const s = w / a.vbW; // px per user unit
      const top = HORIZON_AT * h - a.hz * s;
      const [x0, y0, x1, y1] = a.settle;
      const K = Math.max(w / ((x1 - x0) * s), h / ((y1 - y0) * s)) * 0.96;
      const k = Math.pow(K, e);
      const Cx = w / 2 / s;
      const Cy = (h / 2 - top) / s;
      const px = Cx + ((x0 + x1) / 2 - Cx) * e;
      const py = Cy + ((y0 + y1) / 2 - Cy) * e;
      const cam = e > 0 ? `matrix(${k},0,0,${k},${Cx - k * px},${Cy - k * py})` : '';
      if (cam !== last.cam) {
        last.cam = cam;
        a.cam.style.transform = cam;
        root.style.setProperty('--z', String(k)); // hairlines stay hairlines as it nears
      }
      const col = q3(1 - smooth(0.9, 0.97, q));
      if (col !== last.colour) a.colour.style.opacity = String((last.colour = col));
      const fade = q3(1 - smooth(0.93, 0.995, q));
      if (fade !== last.fade) a.cam.style.opacity = String((last.fade = fade));
      const r = q3(smooth(0.95, 1, q));
      if (r !== last.rule) rule.style.transform = `scaleX(${(last.rule = r)})`;
    };

    // ---- life: only while on screen, coloured, the tab visible and nothing covering the page
    let inView = false;
    const updateLive = () => {
      const live =
        inView && q > PANS.colour[0] && q < 0.99 && !document.hidden && !coveredStore.get();
      if (live !== root.hasAttribute('data-live')) root.toggleAttribute('data-live', live);
    };
    const io = new IntersectionObserver(([e]) => {
      inView = !!e?.isIntersecting;
      updateLive();
    });
    io.observe(root);
    document.addEventListener('visibilitychange', updateLive);
    const unsubCovered = coveredStore.subscribe(updateLive);

    // ---- size: measured on resize only ----
    const measure = () => {
      size = { w: root.clientWidth || 1, h: root.clientHeight || 1 };
      if (art) {
        root.style.setProperty('--u', String(art.vbW / size.w));
        root.style.setProperty('--hzw', String(1 / Math.min(window.devicePixelRatio || 1, 2)));
      }
      last.cam = '-';
      render();
    };
    const ro = new ResizeObserver(measure);
    ro.observe(root);

    // ---- the drawing: fetched after mount, inlined so its strokes can animate ----
    const load = async () => {
      const name = portrait.matches ? 'tall' : 'wide';
      try {
        const res = await fetch(asset(`/engravings/pans-${name}.svg`), {
          signal: controller.signal,
        });
        const text = await res.text();
        if (controller.signal.aborted) return;
        host.innerHTML = text;
        const svg = host.querySelector('svg')!;
        svg.querySelector('style')?.remove(); // the CSS module sets user-space stroke widths
        svg.setAttribute('aria-hidden', 'true');
        svg.setAttribute('focusable', 'false');
        art = readArt(svg, low);
        Object.assign(last, { paper: -1, hz: -1, line: -1, colour: -1, cam: '-', fade: -1 });
        measure();
      } catch (err) {
        if ((err as Error).name !== 'AbortError') console.error('Salt pans failed to load', err);
      }
    };
    // ~8 screens down: fetched and inlined in an idle moment once the intro has had its time,
    // never competing with it (nothing waits for this; the scene simply draws once it's in)
    let idleId = 0;
    const later = window.setTimeout(() => {
      if (window.requestIdleCallback)
        idleId = window.requestIdleCallback(() => void load(), { timeout: 2000 });
      else void load();
    }, 3000);
    const onShape = () => void load();
    portrait.addEventListener('change', onShape);

    // ---- one scrubbed timeline over the last PANS_VH of the hero's pin ----
    let kill: (() => void) | undefined;
    void loadGsap().then(({ gsap }) => {
      if (controller.signal.aborted) return;
      const hero = root.closest<HTMLElement>('[data-hero]');
      if (!hero) return;
      const state = { q: 0 };
      const tween = gsap.to(state, {
        q: 1,
        ease: 'none',
        onUpdate: () => {
          q = state.q;
          render();
        },
        scrollTrigger: {
          trigger: hero,
          start: () => `bottom-=${Math.round(window.innerHeight * PANS_VH)} bottom`,
          end: 'bottom bottom',
          scrub: 0.6,
          invalidateOnRefresh: true,
        },
      });
      kill = () => {
        tween.scrollTrigger?.kill();
        tween.kill();
      };
    });

    return () => {
      controller.abort();
      window.clearTimeout(later);
      if (idleId) window.cancelIdleCallback(idleId);
      kill?.();
      io.disconnect();
      ro.disconnect();
      unsubCovered();
      document.removeEventListener('visibilitychange', updateLive);
      portrait.removeEventListener('change', onShape);
    };
  }, []);

  return (
    <div ref={rootRef} className={styles.pans} data-pans>
      <div ref={paperRef} className={styles.paper} aria-hidden="true" />
      {/* motion: the inlined drawing; reduced motion / no JS: the finished field as an image */}
      <div className={styles.field}>
        <div ref={artRef} className={styles.art} />
        <picture className={styles.still}>
          <source media={PORTRAIT} srcSet={asset('/engravings/pans-tall.svg')} />
          <img
            src={asset('/engravings/pans-wide.svg')}
            alt="Salt pans at Sambhar Lake, engraved in gold and coloured pink"
            loading="lazy"
            decoding="async"
          />
        </picture>
      </div>
      {/* [CONFIRM COPY] */}
      <p ref={lineRef} className={`py-display py-d-m ${styles.line}`}>
        The lake turns pink before it gives salt.
      </p>
      <span ref={ruleRef} className={styles.rule} aria-hidden="true" />
    </div>
  );
}
