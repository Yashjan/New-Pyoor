'use client';

import { useEffect, useRef, type CSSProperties } from 'react';
import { loadGsap } from '@/lib/motion/gsap';
import { JOURNEY, JOURNEY_VH, journeyStore } from '@/lib/motion/opening';
import { whenEngraved, whenIntroDone } from '@/lib/loader/prefetch';
import { PANORAMA } from './panorama';
import { LiveLayer, createLiving } from './Living';
import styles from './Journey.module.css';

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
    living.reveal(i, animate ? 1100 : 0);
    if (!animate) return;
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

  const render = (s: number) => {
    current = s;
    root.style.visibility = s > 0.0005 && s < 0.9995 ? 'visible' : 'hidden';
    const inP = phase(s, 0, JOURNEY.in);
    const pan = phase(s, JOURNEY.in, JOURNEY.out);
    const outP = phase(s, JOURNEY.out, 1);

    // SAMBHAR -> the panorama: the word (with सांभर, the subline and the cue) fades right out
    // over the first 40%, the line draws out under it and becomes the horizon; only then does
    // the panorama come in, so the two are never on screen together
    if (opening) opening.style.opacity = outP > 0 ? '' : (1 - ease(phase(inP, 0, 0.4))).toFixed(3);
    const veilIn = ease(phase(inP, 0.4, 0.8));
    veil.style.opacity = veilIn.toFixed(3);
    // ... and at dusk the pin releases: the panorama scrolls up and away
    root.style.transform =
      outP > 0 ? `translate3d(0,${(-outP * root.clientHeight).toFixed(1)}px,0)` : '';
    journeyStore.covered = veilIn >= 1 && outP === 0;
    living.active(inP > 0.7 && outP < 1);
    const handing = inP < 1;
    line.style.visibility = handing ? 'visible' : 'hidden';
    if (handing) {
      const grow = ease(phase(inP, 0, 0.45));
      const y = lineFrom + (lineTo - lineFrom) * ease(phase(inP, 0.4, 1));
      line.style.transform = `translate3d(0,${y.toFixed(2)}px,0) scaleX(${grow.toFixed(4)})`;
    }
    const horizon = svgs.far?.querySelector<SVGGElement>('g[data-s="h"]');
    if (horizon) horizon.style.visibility = inP >= 1 ? 'visible' : 'hidden';

    wash.style.opacity = (0.04 + 0.06 * pan).toFixed(4);

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
      const on = 1 - ease(phase(d, 0.2, 0.42));
      el.style.opacity = (on * ease(phase(inP, 0.7, 1))).toFixed(3);
    });
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
        scrub: 0.7,
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

  // The drawing arrives after the intro, so it can't compete with the engraving.
  void (async () => {
    await whenIntroDone(controller.signal);
    const texts = await Promise.all(
      LAYERS.map((l) =>
        fetch(`/engravings/journey-${l}.svg`, { signal: controller.signal }).then((r) => r.text()),
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
    render(current);
  };
  window.addEventListener('resize', onResize);

  return () => {
    cancelled = true;
    controller.abort();
    window.removeEventListener('resize', onResize);
    animations.forEach((a) => a.cancel());
    living.destroy();
    opening?.style.removeProperty('opacity');
    kill?.();
    journeyStore.covered = false;
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
    // nothing of the panorama runs during the SAMBHAR engraving: it mounts once that's drawn
    const gate = new AbortController();
    let teardown: (() => void) | undefined;
    void whenEngraved(gate.signal).then(() => {
      if (!gate.signal.aborted) teardown = mountPanorama(rootRef.current);
    });
    return () => {
      gate.abort();
      teardown?.();
    };
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
                  src={`/engravings/journey-${l}.svg`}
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
              <LiveLayer layer="near" scene={i} />
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
