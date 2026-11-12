'use client';

import { useEffect, useRef, type CSSProperties } from 'react';
import { loadGsap } from '@/lib/motion/gsap';
import { JOURNEY, JOURNEY_VH, STEP, journeyStore } from '@/lib/motion/opening';
import { FOV, heroCamera, jarStartX, layoutFor } from '@/lib/motion/heroCamera';
import { LIVE, PANORAMA } from './panorama';
import { LiveLayer, createLiving } from './Living';
import styles from './Journey.module.css';
import { asset } from '@/lib/basePath';

const SCENES = [
  {
    title: 'Brine',
    alt: 'Etching at dawn: a wooden sluice lets water into the nearest of many rectangular salt pans.',
    text: 'Lake water is let into shallow pans across the flats.',
    sun: [76, 190, true],
  },
  {
    title: 'Sun',
    alt: 'Etching in the morning: the sun over a grid of pans, cross-hatched salt mounds on the horizon.',
    text: 'The Rajasthan sun and wind slowly evaporate the water until crystals form.',
    sun: [62, 120],
  },
  {
    title: 'Harvest',
    alt: 'Etching at midday: a small figure draws a long rake through the brine beside a salt mound.',
    text: 'Crystals are raked, gathered into mounds and sun-dried.',
    sun: [50, 92],
  },
  {
    title: 'Carry',
    alt: 'Etching in the afternoon: a woman walks through shallow water, a basket of salt on her head.',
    text: 'Heaped in baskets, the salt is carried from the pans by hand. [CONFIRM]',
    sun: [36, 120],
  },
  {
    title: 'Jar',
    alt: 'Etching at dusk: the Pyoor jar on a small heap of black salt.',
    text: 'Packed at Sambhar in clear 1 kg jars, each marked with its batch.',
    sun: [22, 190, true],
  },
] as const;

const LAYERS = ['sky', 'far', 'near'] as const;
type Layer = (typeof LAYERS)[number];

const phase = (t: number, a: number, b: number) => Math.min(1, Math.max(0, (t - a) / (b - a)));
const ease = (t: number) => t * t * (3 - 2 * t);
const dot = (a: number[], b: number[]) => a[0]! * b[0]! + a[1]! * b[1]! + a[2]! * b[2]!;
const norm = (a: number[]) => {
  const l = Math.hypot(a[0]!, a[1]!, a[2]!);
  return a.map((v) => v / l);
};

/** A quiet sun: one fine ring, paper-bright inside, crossed low by level lines of light. */
function Sun() {
  return (
    <svg viewBox="-33 -33 66 66" aria-hidden="true" focusable="false">
      <circle r="31" />
      {[6, 12, 18, 24].map((y) => {
        const h = Math.sqrt(29.5 * 29.5 - y * y);
        return <path key={y} d={`M${-h} ${y}H${h}`} />;
      })}
    </svg>
  );
}

/** The motion panorama: measures, drives the layers from the scroll, fetches the drawing. */
function mountPanorama(root: HTMLDivElement | null): (() => void) | undefined {
  const html = document.documentElement;
  if (!root || !html.classList.contains('motion')) return;
  const hero = root.closest<HTMLElement>('[data-hero]')!;
  const $ = <T extends HTMLElement>(s: string) => root.querySelector<T>(s)!;
  const veil = $('[data-veil]');
  const wash = $('[data-wash]');
  const sun = $('[data-sun]');
  const line = $('[data-handoff]');
  const captions = [...root.querySelectorAll<HTMLElement>('[data-scene]')];
  const layerEls = Object.fromEntries(
    LAYERS.map((l) => [l, root.querySelector<HTMLElement>(`[data-layer="${l}"]`)!]),
  ) as Record<Layer, HTMLElement>;
  const svgs: Partial<Record<Layer, SVGSVGElement>> = {};
  const drawn = [false, false, false, false, false];
  const living = createLiving(root);
  const animations = new Set<Animation>();

  let k = 1;
  let vw = 0;
  let artTop = 0;
  let lineFrom = 0;
  let lineTo = 0;
  let current = 0;

  const sizeLayer = (l: Layer) => {
    const svg = svgs[l];
    if (!svg) return;
    svg.style.width = `${PANORAMA.layers[l].width * k}px`;
    svg.style.height = `${PANORAMA.height * k}px`;
  };

  const measure = () => {
    vw = root.clientWidth;
    const vh = root.clientHeight;
    const phone = vw < 700;
    const artH = phone ? Math.round(vh * 0.6) : vh;
    artTop = 0;
    if (phone) {
      const caption = Math.max(...captions.map((c) => c.offsetHeight));
      artTop = Math.round(64 + Math.max(0, (vh - 64 - artH - 14 - caption) / 2));
    }
    k = artH / PANORAMA.height;
    root.style.setProperty('--k', String(k));
    root.style.setProperty('--u', String(1 / k));
    root.style.setProperty('--lmin', window.devicePixelRatio < 2 ? '1' : '0.75');
    root.style.setProperty('--art-top', `${artTop}px`);
    root.style.setProperty('--art-h', `${artH}px`);
    LAYERS.forEach(sizeLayer);
    const word = document.querySelector('[data-opening] svg');
    const top = root.getBoundingClientRect().top;
    lineFrom = (word ? word.getBoundingClientRect().bottom - top : vh / 2) + 14;
    lineTo = artTop + PANORAMA.horizon * k;
  };

  /** The scene's strokes from every layer, drawn over 1.2 s, once. */
  const drawScene = (i: number, animate: boolean) => {
    if (drawn[i] || !svgs.near || !svgs.far || !svgs.sky) return;
    drawn[i] = true;
    const groups = LAYERS.map((l) => svgs[l]!.querySelector<SVGGElement>(`g[data-s="${i}"]`));
    const paths = groups.flatMap((g) =>
      g ? [...g.querySelectorAll('path:not(.p)')] : [],
    ) as SVGPathElement[];
    groups.forEach((g) => g?.style.removeProperty('visibility'));
    if (i === 4 && jar) {
      jar.style.visibility = 'inherit'; // hidden again with the panorama
      paths.push(...(jar.querySelectorAll('path:not(.p)') as NodeListOf<SVGPathElement>));
    }
    living.reveal(i, animate ? 1100 : 0);
    if (!animate) return;
    // ground first (pans, bunds, grid, sky), then mounds, then what stands on them (gate,
    // figures, jar), then the small details: nothing appears floating before its ground
    const rank = (p: SVGPathElement) => {
      const t = Number(p.dataset.t ?? 7);
      return t >= 7 ? 0 : t >= 4 && t <= 5 ? 1 : t <= 3 ? 2 : 3;
    };
    paths.sort((a, b) => rank(a) - rank(b));
    paths.forEach((p, n) => {
      const L = Number(p.dataset.m) || p.getTotalLength();
      const base = Number(p.getAttribute('opacity') ?? 1);
      p.style.strokeDasharray = `${L} ${L * 2}`;
      const anim = p.animate(
        [
          { strokeDashoffset: L, opacity: 0 },
          { strokeDashoffset: L * 0.82, opacity: base, offset: 0.18 },
          { strokeDashoffset: 0, opacity: base },
        ],
        {
          duration: 360,
          delay: (n / paths.length) * 840,
          fill: 'backwards',
          easing: 'linear',
        },
      );
      animations.add(anim);
      anim.onfinish = () => {
        p.style.removeProperty('stroke-dasharray'); // solid again: cheaper to paint
        animations.delete(anim);
      };
    });
  };

  /* ---------------- step 2: the engraved jar becomes the 3D jar ---------------- */
  const jar = root.querySelector<SVGSVGElement>('[data-veil] [data-jar]');
  const jarPaper = jar ? [...jar.querySelectorAll<SVGPathElement>('path.p')] : [];
  const jarLayer = hero.querySelector<HTMLElement>('[data-jar-layer]');
  const canvas = jarLayer?.querySelector('canvas') ?? null;
  const J = LIVE.jar;
  /** The 3D jar's anchors on screen (root px) at the first frame of the jar sequence. */
  let target = { base: [0, 0], top: [0, 0], layerTop: 0, layerH: 1 };
  /**
   * The hero camera at p = 0 (components/hero/scene/camera.ts, layout.ts, jar.ts), projected
   * here without three.js: the same fov, position and target as the scene uses.
   */
  const measureJar = () => {
    if (!canvas || !jarLayer) return;
    const rootTop = root.getBoundingClientRect().top;
    const r = canvas.getBoundingClientRect();
    const w = canvas.clientWidth || r.width;
    const h = canvas.clientHeight || r.height;
    if (!w || !h) return;
    const layout = layoutFor(w, h);
    const jarX = jarStartX(layout);
    const cam = heroCamera(0, layout);
    const P = [...cam.pos];
    const T = [...cam.look];
    const f = norm(T.map((v, i) => v - P[i]!));
    const right = norm([-f[2]!, 0, f[0]!]); // f × up
    const up = [
      right[1]! * f[2]! - right[2]! * f[1]!,
      right[2]! * f[0]! - right[0]! * f[2]!,
      right[0]! * f[1]! - right[1]! * f[0]!,
    ];
    const tan = Math.tan((FOV * Math.PI) / 360);
    const project = (q: number[]) => {
      const d = q.map((v, i) => v - P[i]!);
      const z = dot(d, f);
      return [
        r.left + ((dot(d, right) / (z * tan * (w / h)) + 1) / 2) * w,
        r.top - rootTop + ((1 - dot(d, up) / (z * tan)) / 2) * h,
      ];
    };
    const lr = jarLayer.getBoundingClientRect();
    target = {
      base: project([jarX, J.model.jarY, 0]),
      top: project([jarX, J.model.jarY + J.model.top, 0]),
      layerTop: lr.top - rootTop,
      layerH: lr.height,
    };
  };

  /** Landscape strokes in view at dusk, each with when it starts to un-draw (far first). */
  type Undraw = { el: SVGPathElement; L: number; a: number; u: number };
  let undraw: Undraw[] | null = null;
  let papers: SVGPathElement[] = [];
  const collectUndraw = () => {
    if (undraw || !svgs.near || !svgs.far || !svgs.sky) return;
    const list: Omit<Undraw, 'a'>[] = [];
    const dist: number[] = [];
    for (const l of LAYERS)
      for (const i of [3, 4]) {
        const g = svgs[l]!.querySelector(`g[data-s="${i}"]`);
        g?.querySelectorAll<SVGPathElement>('path:not(.p)').forEach((el) => {
          const bb = el.getBBox();
          dist.push(Math.abs(bb.y + bb.height / 2 - PANORAMA.horizon));
          list.push({ el, L: Number(el.dataset.m) || el.getTotalLength(), u: 0 });
        });
      }
    papers = LAYERS.flatMap((l) => [...svgs[l]!.querySelectorAll<SVGPathElement>('path.p')]);
    const max = Math.max(1, ...dist);
    // far strokes start first; each takes a quarter of step 2 to withdraw
    const [u0, u1] = STEP.undraw;
    const each = (u1 - u0) / 2;
    undraw = list.map((o, n) => ({ ...o, a: u0 + each * (1 - dist[n]! / max) }));
  };

  /**
   * The 3D jar arrived after step 2's reveal had begun (the GLB was late): no fill, the
   * engraving stayed; now the 3D crossfades in over 0.4 s (lateAt: when it arrived).
   */
  let lateAt: number | null = null;
  let lateRaf = 0;
  const LATE_FADE = 400;
  const late = () => (lateAt === null ? 1 : Math.min(1, (performance.now() - lateAt) / LATE_FADE));
  let missed = false; // the reveal began before the 3D was ready
  journeyStore.onReady = () => {
    if (!stepping || !missed || lateAt !== null) return; // on time: the normal reveal
    lateAt = performance.now();
    const go = () => {
      render(current);
      if (late() < 1) lateRaf = requestAnimationFrame(go);
    };
    go();
  };

  const glints = () => root.querySelectorAll<SVGSVGElement>('[data-veil] [data-live="glint"]');
  let stepping = false;
  const step2 = (t: number, farTx: number) => {
    if (t <= 0 || t >= 1) {
      if (!stepping) return;
      stepping = false;
      lateAt = null;
      missed = false;
      jarLayer?.style.removeProperty('opacity');
      // back in the panorama, or handed over: nothing of step 2 remains
      hero.removeAttribute('data-step');
      root.removeAttribute('data-step');
      hero.style.removeProperty('--step-copy');
      veil.style.removeProperty('background-color');
      line.style.removeProperty('opacity');
      line.style.removeProperty('mask-image');
      line.style.removeProperty('-webkit-mask-image');
      jarLayer?.style.removeProperty('mask-image');
      jarLayer?.style.removeProperty('-webkit-mask-image');
      if (jar) {
        jar.style.removeProperty('transform');
        jar.style.removeProperty('opacity');
      }
      [...jarPaper, ...papers].forEach((el) => el.style.removeProperty('opacity'));
      glints().forEach((el) => el.style.removeProperty('display'));
      undraw?.forEach((o) => {
        o.u = 0;
        o.el.style.removeProperty('stroke-dasharray');
        o.el.style.removeProperty('stroke-dashoffset');
        o.el.style.removeProperty('visibility');
      });
      return;
    }
    if (!stepping) {
      stepping = true;
      collectUndraw();
      measureJar();
      hero.setAttribute('data-step', '');
      root.setAttribute('data-step', '');
    }

    // a. the landscape withdraws into the horizon, stroke by stroke (STEP.undraw)
    undraw?.forEach((o) => {
      const u = +phase(t, o.a, o.a + (STEP.undraw[1] - STEP.undraw[0]) / 2).toFixed(3);
      if (u === o.u) return;
      o.u = u;
      if (u === 0) {
        o.el.style.removeProperty('stroke-dasharray');
        o.el.style.removeProperty('stroke-dashoffset');
        o.el.style.removeProperty('visibility');
        return;
      }
      o.el.style.strokeDasharray = `${o.L} ${o.L * 2}`;
      o.el.style.strokeDashoffset = (o.L * u).toFixed(1);
      // fully gone: hidden, or the round caps would leave a dot where each stroke began
      o.el.style.visibility = u >= 1 ? 'hidden' : '';
    });
    glints().forEach((el) => (el.style.display = t > 0.08 ? 'none' : ''));
    // the paper goes as the landscape has gone (the 3D jar shows under the lines)
    // Without the 3D jar (not loaded yet) the engraved jar stays whole: its paper, its lines,
    // no fill; whenever the 3D arrives it crossfades in (late()).
    if (t >= STEP.reveal[0] && !journeyStore.ready3d) missed = true;
    const ready = journeyStore.ready3d && (!missed || lateAt !== null);
    const f = ready ? late() : 0;
    const lerp = (a: number, b: number) => a + (b - a) * f;
    const paper = 1 - phase(t, ...STEP.paper);
    veil.style.backgroundColor = `rgba(245, 241, 232, ${paper.toFixed(3)})`;
    papers.forEach((el) => (el.style.opacity = paper.toFixed(3)));
    jarPaper.forEach((el) => (el.style.opacity = lerp(1, paper).toFixed(3)));

    // b. the engraving glides to where the 3D jar stands (STEP.glide)
    const qb = J.anchors.base;
    const qt = J.anchors.top;
    const sT = (target.base[1]! - target.top[1]!) / (qb[1] - qt[1]);
    const A = [target.base[0]! - sT * qb[0], target.base[1]! - sT * qb[1]];
    const g = ease(phase(t, ...STEP.glide));
    const sG = k + (sT - k) * g;
    const AG = [farTx + (A[0]! - farTx) * g, artTop + (A[1]! - artTop) * g];
    if (jar) {
      const cx = AG[0]! + sG * J.box[0] - farTx - J.box[0] * k;
      const cy = AG[1]! + sG * J.box[1] - artTop - J.box[1] * k;
      jar.style.transform = `translate(${cx.toFixed(2)}px,${cy.toFixed(2)}px) scale(${(sG / k).toFixed(5)})`;
      // d. the gold lines fade; the 3D jar stays (STEP.lines)
      jar.style.opacity = lerp(1, 1 - phase(t, ...STEP.lines)).toFixed(3);
    }

    // the horizon, behind the jar (a gap where the jar stands in front of it)
    const x0 = AG[0]! + sG * (J.box[0] + 6);
    const x1 = AG[0]! + sG * (J.box[0] + J.box[2] - 6);
    const gap = `linear-gradient(90deg, #000 ${(x0 - 1).toFixed(1)}px, transparent ${x0.toFixed(1)}px, transparent ${x1.toFixed(1)}px, #000 ${(x1 + 1).toFixed(1)}px)`;
    // it comes down with the jar to its foot, where the 3D scene's own gold line runs
    const ly = lineTo + (target.base[1]! - lineTo) * g;
    line.style.transform = `translate3d(0,${ly.toFixed(2)}px,0)`;
    line.style.maskImage = gap;
    line.style.setProperty('-webkit-mask-image', gap);
    line.style.opacity = (1 - phase(t, ...STEP.hand)).toFixed(3);

    // c. the 3D jar, revealed from the bottom up with a soft edge, like the ink fill (STEP.reveal)
    if (jarLayer && (!ready || lateAt !== null)) {
      // nothing to reveal yet (not even the poster), or the late crossfade: no fill
      const m = ready ? 'none' : 'linear-gradient(transparent, transparent)';
      jarLayer.style.maskImage = m;
      jarLayer.style.setProperty('-webkit-mask-image', m);
      jarLayer.style.opacity = f.toFixed(3);
    } else if (jarLayer) {
      jarLayer.style.removeProperty('opacity');
      const r = phase(t, ...STEP.reveal); // linear: the jar fills at the scroll's own pace
      const from = Math.max(target.base[1]!, target.top[1]!) + 40;
      const to = Math.min(target.base[1]!, target.top[1]!) - 40;
      const edge = (r <= 0 ? target.layerH + 60 : from + (to - from) * r) - target.layerTop;
      const m = `linear-gradient(180deg, transparent ${(edge - 18).toFixed(1)}px, #000 ${(edge + 18).toFixed(1)}px)`;
      jarLayer.style.maskImage = m;
      jarLayer.style.setProperty('-webkit-mask-image', m);
    }

    // e. the headline and the rest of the first frame of the jar sequence (STEP.hand)
    hero.style.setProperty('--step-copy', phase(t, ...STEP.hand).toFixed(3));
  };

  const render = (s: number) => {
    current = s;
    root.dataset.progress = s.toFixed(4); // read by tests/scroll.spec.ts
    root.style.visibility = s > 0.0005 && s < 0.9995 ? 'visible' : 'hidden';
    const inP = phase(s, 0, JOURNEY.in);
    const pan = phase(s, JOURNEY.in, JOURNEY.out);
    const outP = phase(s, JOURNEY.out, 1);

    // SAMBHAR -> the panorama: the word (with सांभर, the subline and the cue) fades right out
    // over the first 40%, the line draws out under it and becomes the horizon; only then does
    // the panorama come in, so the two are never on screen together
    if (opening)
      opening.style.opacity =
        s >= 1 ? '' : outP > 0 ? '0' : (1 - ease(phase(inP, 0, 0.4))).toFixed(3);
    const veilIn = ease(phase(inP, 0.4, 0.8));
    veil.style.opacity = veilIn.toFixed(3);
    journeyStore.covered = veilIn >= 1 && outP === 0;
    // the jar holds still while step 2 lines the engraving up on it, then floats again
    journeyStore.calm = s < 1 ? 1 - phase(outP, ...STEP.hand) : 0;
    // the 3D scene stays unseen (and unrendered) until step 2's reveal begins
    journeyStore.show3d = s >= 1 || outP >= STEP.reveal[0];
    journeyStore.reveal = s >= 1 ? 1 : phase(outP, ...STEP.reveal);
    living.active(inP > 0.7 && outP === 0);
    const handing = inP < 1;
    line.style.visibility = handing || (outP > 0 && outP < 1) ? 'visible' : 'hidden';
    if (handing) {
      const grow = ease(phase(inP, 0, 0.45));
      const y = lineFrom + (lineTo - lineFrom) * ease(phase(inP, 0.4, 1));
      line.style.transform = `translate3d(0,${y.toFixed(2)}px,0) scaleX(${grow.toFixed(4)})`;
    }
    const horizon = svgs.far?.querySelector<SVGGElement>('g[data-s="h"]');
    // (in step 2 the horizon is the line, so the jar can pass in front of it)
    if (horizon) horizon.style.visibility = inP >= 1 && outP === 0 ? 'visible' : 'hidden';

    wash.style.opacity = ((0.04 + 0.06 * pan) * (1 - phase(outP, ...STEP.paper))).toFixed(4);

    // the three layers, each scene centred in all of them at the same moment
    // (a phone shows less than a scene, so it re-centres on the jar at the very end)
    const jarTail = vw < 700 ? PANORAMA.jarDx * ease(phase(pan, 0.75, 1)) : 0;
    const view = (l: Layer) => {
      const c = PANORAMA.layers[l].centers;
      return c[0] + pan * (c[4] - c[0]) + jarTail * PANORAMA.layers[l].speed;
    };
    living.scroll(pan);
    for (const l of LAYERS) {
      layerEls[l].style.transform = `translate3d(${(vw / 2 - view(l) * k).toFixed(2)}px,0,0)`;
    }

    // one sun for the time of day: half-sunk on the right at dawn, high at midday, half-sunk
    // on the left at dusk; clipped at the horizon, with open sky around it
    const arc = (2 * pan - 1) ** 2;
    const phone = vw < 700;
    const sx = (phone ? 0.84 - 0.72 * pan : 0.76 - 0.54 * pan) * vw;
    const sy = artTop + (92 + (PANORAMA.horizon - 92) * arc) * k;
    sun.style.transform = `translate3d(${sx.toFixed(1)}px,${sy.toFixed(1)}px,0) translate(-50%,-50%)`;
    const below = sy + 48 * k - (artTop + PANORAMA.horizon * k);
    sun.style.clipPath = below > 0 ? `inset(0 0 ${below.toFixed(1)}px 0)` : '';

    // one caption at a time; a scene draws itself as it comes into view
    const x = view('near');
    const c = PANORAMA.layers.near.centers;
    captions.forEach((el, i) => {
      const d = Math.abs(x - c[i]!) / PANORAMA.scene;
      const on = 1 - ease(phase(d, 0.44, 0.5)); // held while its scene is on screen
      el.style.opacity = (
        on *
        ease(phase(inP, 0.7, 1)) *
        (1 - phase(outP, ...STEP.caption))
      ).toFixed(3);
    });
    sun.style.opacity = outP > 0 ? (1 - phase(outP, ...STEP.caption)).toFixed(3) : '';
    step2(outP, vw / 2 - view('far') * k);
    if (inP > 0.7) {
      const half = (PANORAMA.scene / 2) * k;
      const tx = vw / 2 - x * k;
      c.forEach((center, i) => {
        if (drawn[i]) return;
        const left = center * k + tx - half;
        const right = center * k + tx + half;
        if (left < vw * 1.1) drawScene(i, right > 0); // already passed: just show it
      });
    }
  };

  const opening = document.querySelector<HTMLElement>('[data-opening]');
  measure();
  measureJar();
  render(0);

  let cancelled = false;
  let kill: (() => void) | undefined;
  const controller = new AbortController();

  void loadGsap().then(({ gsap }) => {
    if (cancelled) return;
    const state = { s: 0 };
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: hero,
        start: 'top top',
        end: () => `+=${Math.round(window.innerHeight * JOURNEY_VH)}`,
        scrub: 0.6,
        invalidateOnRefresh: true,
      },
      onUpdate: () => render(tl.progress()),
    });
    tl.to(state, { s: 1, ease: 'none', duration: 1 });
    kill = () => {
      tl.scrollTrigger?.kill();
      tl.kill();
    };
  });

  // The drawing is fetched at once (~90 KB); it's needed as soon as anyone scrolls.
  void (async () => {
    const texts = await Promise.all(
      LAYERS.map((l) =>
        fetch(asset(`/engravings/journey-${l}.svg`), { signal: controller.signal }).then((r) =>
          r.text(),
        ),
      ),
    );
    if (cancelled) return;
    texts.forEach((text, i) => {
      const l = LAYERS[i]!;
      const art = layerEls[l].querySelector<HTMLElement>('[data-art]')!;
      art.innerHTML = text;
      const svg = art.querySelector('svg')!;
      svg.querySelector('style')?.remove(); // stroke-dash needs user-space widths (the CSS module)
      svg.querySelectorAll<SVGGElement>('g[data-s]').forEach((g) => {
        g.style.visibility = 'hidden';
      });
      svgs[l] = svg;
      sizeLayer(l);
    });
    render(current);
  })().catch((err) => {
    if ((err as Error).name !== 'AbortError') console.error('Journey panorama failed', err);
  });

  const onResize = () => {
    measure();
    measureJar();
    render(current);
  };
  window.addEventListener('resize', onResize);

  return () => {
    cancelled = true;
    controller.abort();
    window.removeEventListener('resize', onResize);
    animations.forEach((a) => a.cancel());
    cancelAnimationFrame(lateRaf);
    journeyStore.onReady = null;
    living.destroy();
    opening?.style.removeProperty('opacity');
    kill?.();
    journeyStore.covered = false;
    journeyStore.show3d = true; // no panorama: nothing to wait for
    journeyStore.reveal = 1;
  };
}

/**
 * "A day at Sambhar": one etched panorama, inside the hero's pinned stage, between the SAMBHAR
 * screen and everything that follows it. Scrolling moves the landscape sideways, in three
 * parallax layers; each scene draws itself the first time it comes into view.
 *
 * The drawing is static SVG (public/engravings, tools/engravings): fetched after the intro and
 * inlined so the strokes can animate. Under reduced motion or without JS the five scenes are
 * ordinary images, stacked, fully drawn, and this script does nothing.
 */
export function Journey() {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // mounted at once: the SAMBHAR handoff follows the scroll from the first paint, even
    // mid-engraving (nothing waits for the intro)
    return mountPanorama(rootRef.current);
  }, []);

  // Reduced motion (the still frames): scene 05's engraved jar crossfades to the jar, once.
  useEffect(() => {
    const root = rootRef.current;
    if (!root || document.documentElement.classList.contains('motion')) return;
    const frame = root.querySelectorAll<HTMLElement>('[role="img"]')[4];
    if (!frame) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e?.isIntersecting) return;
        frame.classList.add(styles.jarIn!);
        io.disconnect();
      },
      { threshold: 0.5 },
    );
    io.observe(frame);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={rootRef}
      className={styles.journey}
      role="region"
      aria-label="A day at Sambhar: from lake to jar, in five scenes"
      data-journey
    >
      <div className={styles.veil} data-veil aria-hidden="true">
        <div className={styles.art}>
          <div className={styles.layer} data-layer="sky">
            <div data-art />
          </div>
          <div className={styles.sun} data-sun>
            <Sun />
          </div>
          <div className={styles.layer} data-layer="far">
            <div data-art />
            <LiveLayer layer="far" />
          </div>
          <div className={styles.layer} data-layer="near">
            <div data-art />
            <LiveLayer layer="near" />
          </div>
        </div>
        {/* over the drawing, so the paper-coloured knock-outs stay invisible */}
        <div className={styles.wash} data-wash />
      </div>
      <i className={styles.handoff} data-handoff aria-hidden="true" />
      <ol className={styles.scenes}>
        {SCENES.map((scene, i) => (
          <li key={scene.title} className={styles.scene} data-scene>
            {/* the stacked, fully drawn scene: reduced motion and no JS only */}
            <div className={styles.frame} role="img" aria-label={scene.alt}>
              <span className={styles.frameWash} style={{ opacity: 0.04 + 0.015 * i }} />
              {LAYERS.map((l) => (
                // eslint-disable-next-line @next/next/no-img-element -- SVG drawings, nothing to optimise
                <img
                  key={l}
                  src={asset(`/engravings/journey-${l}.svg`)}
                  alt=""
                  loading="lazy"
                  style={
                    {
                      '--c': PANORAMA.layers[l].centers[i]! / PANORAMA.height,
                      '--w': PANORAMA.layers[l].width / PANORAMA.height,
                    } as CSSProperties
                  }
                />
              ))}
              <LiveLayer layer="far" scene={i} />
              <LiveLayer layer="near" scene={i} />
              {i === 4 && (
                // reduced motion: the engraving crossfades to the jar itself (0.6 s)
                // eslint-disable-next-line @next/next/no-img-element -- a still, sized by the frame
                <img
                  className={styles.frameJar}
                  src={asset('/images/renders/jar-black.webp')}
                  alt=""
                  loading="lazy"
                  style={
                    {
                      '--x': LIVE.jar.anchors.base[0],
                      '--y': LIVE.jar.box[1] + 6,
                      '--h': LIVE.jar.box[3] - 12,
                      '--cc': PANORAMA.layers.far.centers[4],
                    } as CSSProperties
                  }
                />
              )}
              <div
                className={`${styles.frameSun} ${scene.sun[2] ? styles.sunk : ''}`}
                style={{
                  left: `${scene.sun[0]}%`,
                  top: `${(scene.sun[1] / PANORAMA.height) * 100}%`,
                }}
              >
                <Sun />
              </div>
            </div>
            <div className={styles.caption}>
              <div className={styles.num} aria-hidden="true">
                {String(i + 1).padStart(2, '0')}
              </div>
              <h3 className="py-display py-d-m">{scene.title}</h3>
              <p>{scene.text}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
