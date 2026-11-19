'use client';

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { labelReader } from '@/components/LabelReader/LabelReader';
import { calmQueue } from '@/lib/three/calm';
import { useCart } from '@/components/providers/CartProvider';
import { asset } from '@/lib/basePath';
import { MAX_LINE_QUANTITY } from '@/lib/commerce';
import { pickQualityTier } from '@/lib/three/quality';
import { flyToBag } from './flyToBag';
import type { Format } from './plateScene';
import type { Stage } from './stage';
import styles from './Products.module.css';

/** One format of a product: its own size, price, bag variant, still and 3D model. */
export interface FormatProps {
  variantId: string;
  /** "1 kg jar" */
  size: string;
  /** Formatted price, or null while not set (it can't be added then). */
  price: string | null;
  /** The studio still (/images/renders/<name>-studio.{avif,webp}): the poster. */
  render: { name: string; width: number; height: number; blur: string; alt: string };
  /** The live 3D model (none: the still only). */
  model?: string;
  /** The label reader's key for this format (none: no "Read the label"). */
  label?: string;
}

export interface PlateProps {
  handle: string;
  title: string;
  hindi?: string;
  line: string;
  formats: Partial<Record<Format, FormatProps>> & { jar: FormatProps };
  /** e.g. "Save ₹50", in gold-700 (the pair). */
  saving?: string | null;
  wide?: boolean;
  index: number;
  /** In the hero's pin (the lake's opening): its model loads once the pans begin (pyoor:lake-arm). */
  arm?: boolean;
  children?: ReactNode;
}

const ORDER: Format[] = ['jar', 'pouch'];
const SWITCH_MS = 600;
const power2InOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const live3d = () =>
  document.documentElement.classList.contains('motion') &&
  !window.matchMedia('(prefers-reduced-motion: reduce)').matches &&
  !!pickQualityTier();

/**
 * One product plate: the model standing on the plate's gold line (live 3D: the hero's studio,
 * idle sway, drag to turn; its studio still is the poster and the reduced-motion view), a
 * "Jar · Pouch" choice (each with its own size, price and bag variant), names, one line, a
 * quantity stepper, "Add to bag" and "Read the label". Switching: the current model turns
 * away (90°, fading) while the other turns in (0.6 s, power2.inOut).
 */
export function ProductPlate(p: PlateProps) {
  const { add } = useCart();
  const formats = ORDER.filter((f) => p.formats[f]);
  const [fmt, setFmt] = useState<Format>('jar');
  const [qty, setQty] = useState(1);
  const [pending, setPending] = useState(false);
  const [loaded, setLoaded] = useState<Partial<Record<Format, boolean>>>({});
  const [shown, setShown] = useState<Partial<Record<Format, boolean>>>({});
  const plate = useRef<HTMLElement>(null);
  const layers = useRef<Partial<Record<Format, HTMLDivElement | null>>>({});
  const canvases = useRef<Partial<Record<Format, HTMLCanvasElement | null>>>({});
  const posters = useRef<Partial<Record<Format, HTMLImageElement | null>>>({});
  const stages = useRef<Partial<Record<Format, Promise<Stage | null>>>>({});
  const made = useRef<Stage[]>([]);
  const ctrl = useRef<AbortController | null>(null);
  const current = useRef<Format>('jar');
  const anim = useRef(0);
  const f = p.formats[fmt]!;

  /** Builds a format's live model once (lazily); null when there is none or no 3D here. */
  const stageFor = (k: Format) => {
    const spec = p.formats[k];
    const canvas = canvases.current[k];
    if (!spec?.model || !canvas || !live3d()) return Promise.resolve(null);
    ctrl.current ??= new AbortController();
    const signal = ctrl.current.signal;
    stages.current[k] ??= import('./stage')
      .then(({ createStage }) =>
        createStage(canvas, k, spec.model!, signal, () => setShown((s) => ({ ...s, [k]: true }))),
      )
      .then((s) => {
        made.current.push(s);
        s.setActive(current.current === k);
        return s;
      })
      .catch((err) => {
        if ((err as Error).name !== 'AbortError') console.error('Plate model failed', err);
        return null;
      });
    return stages.current[k]!;
  };

  // the posters may have loaded before hydration
  useEffect(() => {
    for (const k of formats)
      if (posters.current[k]?.complete) setLoaded((s) => ({ ...s, [k]: true }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The jar's model: built ahead, one plate at a time and only in calm moments
  // (lib/three/calm.ts). In the hero's pin (the lake's opening) from the moment the hero's 3D
  // jar is ready (pyoor:lake-arm), well before the pans; elsewhere when the plate is within
  // ~2 screens. The pouch's model only when it is asked for (hover or the Jar · Pouch switch).
  useEffect(() => {
    const root = plate.current;
    if (!root || !p.formats.jar.model) return;
    const build = () => void calmQueue(() => stageFor('jar'));
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e?.isIntersecting) return;
        io.disconnect();
        build();
      },
      { rootMargin: '200% 0px' },
    );
    const w = window as Window & { __pyoorLakeArmed?: boolean };
    const armed = () => {
      io.disconnect();
      build();
    };
    if (p.arm && !w.__pyoorLakeArmed)
      window.addEventListener('pyoor:lake-arm', armed, { once: true });
    else if (p.arm) armed();
    else io.observe(root);
    return () => {
      window.removeEventListener('pyoor:lake-arm', armed);
      io.disconnect();
      cancelAnimationFrame(anim.current);
      ctrl.current?.abort();
      made.current.forEach((s) => s.dispose());
      made.current = [];
      stages.current = {};
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function choose(next: Format) {
    const prev = current.current;
    if (next === prev) return;
    current.current = next;
    setFmt(next);
    setQty(1);
    const out = layers.current[prev];
    const inn = layers.current[next];
    if (!out || !inn) return;
    const [sOut, sIn] = await Promise.all([stageFor(prev), stageFor(next)]);
    if (current.current !== next) return; // switched again meanwhile
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const dir: 1 | -1 = ORDER.indexOf(next) > ORDER.indexOf(prev) ? 1 : -1;
    sIn?.setActive(true);
    sOut?.setActive(true);
    cancelAnimationFrame(anim.current);
    let t0 = -1; // from the first frame
    const ms = reduce ? 200 : SWITCH_MS;
    const step = (now: number) => {
      if (t0 < 0) t0 = now;
      const e = power2InOut(Math.min(1, (now - t0) / ms));
      // the models turn in 3D; a poster (no model yet) turns as a card
      sOut?.away(e, dir);
      sIn?.away(1 - e, -dir as 1 | -1);
      out.style.opacity = String(1 - e);
      inn.style.opacity = String(e);
      if (!reduce) {
        out.style.transform = `perspective(900px) rotateY(${dir * 90 * e}deg)`;
        inn.style.transform = `perspective(900px) rotateY(${-dir * 90 * (1 - e)}deg)`;
        if (sOut) out.style.transform = '';
        if (sIn) inn.style.transform = '';
      }
      if (e < 1) anim.current = requestAnimationFrame(step);
      else {
        sOut?.setActive(false);
        out.style.visibility = 'hidden';
      }
    };
    inn.style.visibility = '';
    anim.current = requestAnimationFrame(step);
  }

  async function onAdd() {
    if (pending || !f.price) return;
    setPending(true);
    flyToBag(posters.current[fmt] ?? null);
    try {
      await add(f.variantId, qty, `${p.title}, ${f.size}`);
      setQty(1);
    } finally {
      setPending(false);
    }
  }

  const sweep = () => {
    const root = plate.current;
    if (root && !root.hasAttribute('data-sweep') && live3d()) root.setAttribute('data-sweep', '');
  };
  const r0 = p.formats.jar.render;

  return (
    <article
      ref={plate}
      className={`${styles.plate} ${p.wide ? styles.wide : ''}`}
      data-rise
      style={{ '--i': p.index } as CSSProperties}
      aria-labelledby={`plate-${p.handle}`}
      onPointerEnter={(e) => e.pointerType === 'mouse' && sweep()}
    >
      <div
        className={styles.media}
        data-plate-media
        style={{ aspectRatio: `${r0.width} / ${r0.height}` }}
        onFocus={sweep}
      >
        {formats.map((k) => {
          const spec = p.formats[k]!;
          const src = (ext: string) => asset(`/images/renders/${spec.render.name}-studio.${ext}`);
          return (
            <div
              key={k}
              ref={(el) => {
                layers.current[k] = el;
              }}
              className={styles.layer}
              style={k === 'jar' ? undefined : { opacity: 0, visibility: 'hidden' }}
              aria-hidden={k !== fmt}
            >
              <div
                className={styles.poster}
                style={{
                  backgroundImage: loaded[k] ? undefined : `url(${spec.render.blur})`,
                  opacity: shown[k] ? 0 : 1,
                }}
              >
                <picture>
                  <source srcSet={src('avif')} type="image/avif" />
                  <img
                    ref={(el) => {
                      posters.current[k] = el;
                    }}
                    className={`${styles.still} ${loaded[k] ? styles.loaded : ''}`}
                    src={src('webp')}
                    alt={k === fmt && !shown[k] ? spec.render.alt : ''}
                    width={spec.render.width}
                    height={spec.render.height}
                    loading="lazy"
                    decoding="async"
                    onLoad={() => setLoaded((s) => ({ ...s, [k]: true }))}
                  />
                </picture>
              </div>
              {spec.model && (
                <canvas
                  ref={(el) => {
                    canvases.current[k] = el;
                  }}
                  className={`${styles.gl} ${shown[k] ? styles.glOn : ''}`}
                  tabIndex={k === fmt && shown[k] ? 0 : -1}
                  role="img"
                  aria-label={`${spec.render.alt} in 3D. Drag, or use the left and right arrow keys, to turn it.`}
                />
              )}
            </div>
          );
        })}
        {/* the plate's gold horizon: the model stands on it (plateScene PLATE.line) */}
        <span className={styles.ground} aria-hidden="true" data-plate-ground />
        <span
          className={styles.sweep}
          aria-hidden="true"
          onAnimationEnd={() => plate.current?.removeAttribute('data-sweep')}
        />
      </div>

      {formats.length > 1 && (
        <div
          className={styles.formats}
          data-plate-detail
          role="radiogroup"
          aria-label={`Format, ${p.title}`}
        >
          {formats.map((k, i) => (
            <span key={k} className={styles.formatItem}>
              {i > 0 && (
                <span className={styles.formatDot} aria-hidden="true">
                  ·
                </span>
              )}
              <button
                type="button"
                role="radio"
                aria-checked={k === fmt}
                className={styles.format}
                onClick={() => void choose(k)}
                onPointerEnter={() => void stageFor(k)}
              >
                {k === 'jar' ? 'Jar' : 'Pouch'}
              </button>
            </span>
          ))}
        </div>
      )}

      <div className={styles.body} data-plate-body>
        <h3 id={`plate-${p.handle}`} className={styles.name}>
          {p.title}
        </h3>
        {p.hindi && (
          <p className={styles.hindi} lang="hi">
            {p.hindi}
          </p>
        )}
        <p className={styles.line}>{p.line}</p>
        <p className={styles.price} aria-live="polite">
          <span>{f.size}</span>
          <span aria-hidden="true"> · </span>
          <span className="sr-only">, price </span>
          <span className={styles.amount}>{f.price ?? 'Price coming soon'}</span>
          {p.saving && <span className={styles.saving}>{p.saving}</span>}
        </p>
        <div className={styles.buy}>
          <div className={styles.stepper} role="group" aria-label={`Quantity, ${p.title}`}>
            <button
              type="button"
              onClick={() => setQty((q) => Math.max(1, q - 1))}
              disabled={qty <= 1 || !f.price}
              aria-label={`Decrease quantity, ${p.title}`}
            >
              −
            </button>
            <output aria-live="polite" aria-label={`Quantity, ${p.title}`}>
              {qty}
            </output>
            <button
              type="button"
              onClick={() => setQty((q) => Math.min(MAX_LINE_QUANTITY, q + 1))}
              disabled={qty >= MAX_LINE_QUANTITY || !f.price}
              aria-label={`Increase quantity, ${p.title}`}
            >
              +
            </button>
          </div>
          <button
            type="button"
            className={styles.add}
            onClick={onAdd}
            disabled={!f.price}
            aria-busy={pending}
          >
            <span className={styles.addText}>{f.price ? 'Add to bag' : 'Price coming soon'}</span>
            <span className="sr-only">
              : {p.title}, {f.size}
            </span>
          </button>
        </div>
        {f.label && (
          <button
            type="button"
            className={styles.read}
            aria-haspopup="dialog"
            aria-controls="label-reader"
            onClick={(e) => labelReader.open?.(f.label!, e.currentTarget)}
          >
            Read the label
            <span className="sr-only">
              : {p.title}, {fmt}
            </span>
          </button>
        )}
        {p.children}
      </div>
    </article>
  );
}
