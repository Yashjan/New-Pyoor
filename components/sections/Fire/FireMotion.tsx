'use client';

import { useEffect, useRef } from 'react';
import { whenCalm } from '@/lib/three/calm';
import { asset } from '@/lib/basePath';
import { loadGsap } from '@/lib/motion/gsap';
import { fireCrack, fireLevel } from '@/lib/sound/sound';

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const span = (q: number, a: number, b: number) => clamp01((q - a) / (b - a));
const smooth = (a: number, b: number, q: number) => {
  const t = span(q, a, b);
  return t * t * (3 - 2 * t);
};

/**
 * 05 · The fire, scrubbed (fractions of the section's scroll, from its top at 60% of the
 * screen to its bottom at the bottom; the stage is pinned by CSS: position sticky):
 *
 *   .06–.20  1  the salt in its vessel draws in
 *   .22–.34  2  the mixing (1 fades)
 *   .36–.48  3  the pots go into the bhatti; the hours start: 00 h → 32 h by .72
 *   .50–.60  4  the fire: cakes, flames (they flicker), sparks; the amber glow to 18% and
 *               breathing; the crackle (sound)
 *   .74–.86  5  broken by hand (the crack at .86); the glow goes; the grains turn from dark
 *               violet-black to pinkish-brown by .97; the link to the black salt
 *
 * Each frame's lines draw with stroke-dashoffset, in the order they were cut (data-t); one CSS
 * variable per frame (--u) drives all of them. Transform, opacity and stroke-dashoffset only;
 * the boxes have fixed sizes (nothing shifts). The loops run only on screen.
 */
const FRAMES: [number, number][] = [
  [0.06, 0.2],
  [0.22, 0.34],
  [0.36, 0.48],
  [0.5, 0.6],
  [0.74, 0.86],
];
const TEXT_AT = [0.06, 0.22, 0.36, 0.5, 0.74, 1.01];

export function FireMotion() {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const root = ref.current?.closest<HTMLElement>('[data-fire]');
    if (!root || !document.documentElement.classList.contains('motion')) return;
    const controller = new AbortController();
    const frames = [...root.querySelectorAll<HTMLElement>('[data-fire-frame]')];
    const arts = [...root.querySelectorAll<HTMLElement>('[data-fire-art]')];
    const texts = [...root.querySelectorAll<HTMLElement>('[data-fire-text]')];
    const hours = root.querySelector<HTMLElement>('[data-fire-hours]')!;
    const glow = root.querySelector<HTMLElement>('[data-fire-glow]')!;
    const shop = root.querySelector<HTMLElement>('[data-fire-shop]')!;
    let svgs: (SVGSVGElement | null)[] = [null, null, null, null, null];
    // portrait screens get the frames' portrait crops (fire.mjs)
    const tall = window.matchMedia('(max-aspect-ratio: 3/4)').matches;
    let flames: SVGGElement[] = [];
    let sparks: SVGCircleElement[] = [];
    let soot: SVGGElement | null = null;
    let flameBox: SVGGElement | null = null;

    // ---- the engravings: fetched before the section, inlined so their lines can draw ----
    const load = async () => {
      const got = await Promise.all(
        arts.map(async (a, i) => {
          const res = await fetch(asset(`/engravings/fire-${i + 1}${tall ? '-tall' : ''}.svg`), {
            signal: controller.signal,
          });
          return res.ok ? res.text() : '';
        }),
      );
      // one frame per calm moment: measuring every line (getTotalLength) at once stalls a frame
      for (const [i, text] of got.entries()) {
        await whenCalm(controller.signal);
        if (!text) continue;
        const art = arts[i]!;
        const alt = art.querySelector('img')?.alt ?? '';
        art.innerHTML = text;
        const svg = art.querySelector('svg')!;
        svg.setAttribute('role', 'img');
        svg.setAttribute('aria-label', alt);
        for (const p of svg.querySelectorAll<SVGPathElement>('path:not(.p)')) {
          if (p.closest('[data-fill]')) continue;
          const m = Number(p.dataset.m) || Math.ceil(p.getTotalLength()) + 1;
          const t = Number(p.dataset.t) || 1;
          p.style.setProperty('--m', String(m));
          p.style.setProperty('--d', String(Math.min(0.5, (t - 1) / 14)));
        }
        svgs[i] = svg;
        if (i === 3) {
          flameBox = svg.querySelector<SVGGElement>('[data-s="flame"]');
          flames = [...svg.querySelectorAll<SVGGElement>('[data-s^="flame-"]')];
          sparks = [...svg.querySelectorAll<SVGCircleElement>('[data-sparks] circle')];
          soot = svg.querySelector<SVGGElement>('[data-soot]');
        }
      }
      art0();
      render();
    };
    const art0 = () => root.toggleAttribute('data-inline', svgs.every(Boolean));
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e?.isIntersecting) return;
        io.disconnect();
        void load().catch(() => {});
      },
      { rootMargin: '150% 0px' },
    );
    io.observe(root);

    // ---- the loops (flames, sparks, breathing glow): only while on screen and burning ----
    let onScreen = false;
    let burning = false;
    const live = () => root.toggleAttribute('data-live', onScreen && burning && !document.hidden);
    const seen = new IntersectionObserver(([e]) => {
      onScreen = !!e?.isIntersecting;
      live();
    });
    seen.observe(root);
    document.addEventListener('visibilitychange', live);

    // ---- the scene at q ----
    let q = 0;
    let last = { q: -1, h: '', fire: -1 };
    const render = () => {
      for (let i = 0; i < 5; i++) {
        const [a, b] = FRAMES[i]!;
        const u = span(q, a, b);
        // in as it draws; out as the next one starts drawing (the last stays)
        const next = FRAMES[i + 1];
        const out = next ? 1 - smooth(next[0], next[0] + 0.04, q) : 1;
        const vis = (i === 0 ? 1 : smooth(a, a + 0.03, q)) * out;
        const f = frames[i]!;
        f.style.opacity = vis.toFixed(3);
        f.style.visibility = vis > 0 ? '' : 'hidden';
        svgs[i]?.style.setProperty('--u', u.toFixed(4));
        const t = texts[i]!;
        const tv =
          smooth(TEXT_AT[i]!, TEXT_AT[i]! + 0.03, q) *
          (1 - smooth(TEXT_AT[i + 1]!, TEXT_AT[i + 1]! + 0.03, q));
        t.style.opacity = tv.toFixed(3);
        t.style.transform = `translateY(${(8 * (1 - smooth(TEXT_AT[i]!, TEXT_AT[i]! + 0.03, q))).toFixed(1)}px)`;
      }
      // frame 1 is there from the start (it draws as you arrive)
      // the hours of fire
      const h = String(Math.round(32 * span(q, 0.4, 0.72))).padStart(2, '0') + ' h';
      if (h !== last.h) hours.textContent = last.h = h;
      // the burn builds with the hours (hrs 0–32): the glow 4% → 18% at ~24 h → 14% at 32 h
      // (its gradient is 18%: this is a share of it), still breathing; the flames taller and
      // more of them up to ~20 h, then calmer; the sparks thicken, then thin; the pots darken
      const hrs = 32 * span(q, 0.4, 0.72);
      const amber = hrs < 24 ? 0.04 + 0.14 * smooth(0, 24, hrs) : 0.18 - 0.04 * smooth(24, 32, hrs);
      const g = (amber / 0.18) * smooth(0.4, 0.44, q) * (1 - smooth(0.74, 0.82, q));
      glow.style.opacity = g.toFixed(3);
      const grow = hrs < 20 ? smooth(0, 20, hrs) : 1 - 0.35 * smooth(20, 32, hrs);
      const n = Math.round(3 + 11 * grow);
      flames.forEach((f, i) => f.style.setProperty('opacity', i < n ? '1' : '0'));
      flameBox?.style.setProperty('transform', `scaleY(${(0.6 + 0.55 * grow).toFixed(3)})`);
      const ns = Math.round(18 * (hrs < 18 ? smooth(2, 18, hrs) : 1 - 0.7 * smooth(18, 32, hrs)));
      sparks.forEach((c, i) => c.style.setProperty('visibility', i < ns ? 'visible' : 'hidden'));
      soot?.style.setProperty('opacity', (0.42 * smooth(4, 32, hrs)).toFixed(3));
      // a slow push-in on the bhatti through the burn (frames 3–4)
      const push = `scale(${(1 + 0.12 * smooth(0.36, 0.74, q)).toFixed(4)})`;
      frames[2]!.style.transform = push;
      frames[3]!.style.transform = push;
      // frame 5: a slow push-in on the broken lump, to the pin's end (no still tail)
      frames[4]!.style.transform = `scale(${(1 + 0.1 * smooth(0.74, 1, q)).toFixed(4)})`;
      const b = q > 0.52 && q < 0.82;
      if (b !== burning) {
        burning = b;
        root.toggleAttribute('data-burning', b);
        live();
      }
      const fl = smooth(0.52, 0.58, q) * (1 - smooth(0.74, 0.84, q));
      if (Math.abs(fl - last.fire) > 0.02 || (fl === 0 && last.fire !== 0))
        fireLevel((last.fire = fl));
      // the crack, once, forward only
      if (last.q < 0.86 && q >= 0.86 && last.q >= 0) fireCrack();
      // the grains' colour
      root.style.setProperty('--ground', smooth(0.82, 1, q).toFixed(3));
      shop.style.opacity = smooth(0.9, 0.95, q).toFixed(3);
      shop.style.visibility = q > 0.9 ? '' : 'hidden';
      last.q = q;
    };
    render();

    let kill: (() => void) | undefined;
    void loadGsap().then(({ gsap }) => {
      if (controller.signal.aborted) return;
      const state = { q: 0 };
      const tween = gsap.to(state, {
        q: 1,
        ease: 'none',
        onUpdate: () => {
          q = state.q;
          render();
        },
        scrollTrigger: {
          trigger: root,
          start: 'top 60%',
          end: 'bottom bottom',
          scrub: 0.5,
        },
      });
      kill = () => {
        tween.scrollTrigger?.kill();
        tween.kill();
      };
    });

    return () => {
      controller.abort();
      io.disconnect();
      seen.disconnect();
      document.removeEventListener('visibilitychange', live);
      kill?.();
      fireLevel(0);
      svgs = [];
      last = { q: -1, h: '', fire: -1 };
    };
  }, []);
  return <span ref={ref} hidden />;
}
