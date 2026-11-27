'use client';

import { useEffect, useRef, useState } from 'react';
import { labelReader } from '@/components/LabelReader/LabelReader';
import { useCart } from '@/components/providers/CartProvider';
import { flyToBag } from '@/components/sections/Products/flyToBag';
import type { Stage } from '@/components/sections/Products/stage';
import { MAX_LINE_QUANTITY } from '@/lib/commerce';
import { stillSrc, type ShopFormat, type ShopSalt } from '@/lib/commerce/shop';
import { pickQualityTier } from '@/lib/three/quality';
import styles from './Product.module.css';

const live3d = () =>
  document.documentElement.classList.contains('motion') &&
  !window.matchMedia('(prefers-reduced-motion: reduce)').matches &&
  !!pickQualityTier();

/**
 * The product page's top: the live model (the plates' shared WebGL renderer and studio: idle
 * sway, drag to turn ±60°; its studio still is the poster and the reduced-motion view), and the
 * details (eyebrow, name, line, price, Jar · Pouch, quantity, Add to bag). Phones: the model on
 * top, and a sticky bottom bar with the price and Add to bag once the main button scrolls away.
 */
export function ProductView({
  salt,
  models,
  free,
}: {
  salt: ShopSalt;
  /** the formats' .glb URLs */
  models: Partial<Record<ShopFormat, string>>;
  /** "Free shipping from ₹499" */
  free: string | null;
}) {
  const { add } = useCart();
  const keys = (['jar', 'pouch'] as const).filter((k) => salt.formats[k]);
  const [fmt, setFmt] = useState<ShopFormat>('jar');
  const [qty, setQty] = useState(1);
  const [pending, setPending] = useState(false);
  const [shown, setShown] = useState<Partial<Record<ShopFormat, boolean>>>({});
  const [bar, setBar] = useState(false);
  const canvases = useRef<Partial<Record<ShopFormat, HTMLCanvasElement | null>>>({});
  const posters = useRef<Partial<Record<ShopFormat, HTMLImageElement | null>>>({});
  const stages = useRef<Partial<Record<ShopFormat, Promise<Stage | null>>>>({});
  const made = useRef<Stage[]>([]);
  const ctrl = useRef<AbortController | null>(null);
  const current = useRef<ShopFormat>('jar');
  const buyRef = useRef<HTMLDivElement>(null);
  const f = salt.formats[fmt]!;

  const stageFor = (k: ShopFormat) => {
    const url = models[k];
    const canvas = canvases.current[k];
    if (!url || !canvas || !live3d()) return Promise.resolve(null);
    ctrl.current ??= new AbortController();
    const signal = ctrl.current.signal;
    stages.current[k] ??= import('@/components/sections/Products/stage')
      .then(({ createStage }) =>
        createStage(canvas, k, url, signal, () => setShown((s) => ({ ...s, [k]: true }))),
      )
      .then((s) => {
        made.current.push(s);
        s.setActive(current.current === k);
        return s;
      })
      .catch((err) => {
        if ((err as Error).name !== 'AbortError') console.error('Product model failed', err);
        return null;
      });
    return stages.current[k]!;
  };

  useEffect(() => {
    void stageFor('jar');
    return () => {
      ctrl.current?.abort();
      made.current.forEach((s) => s.dispose());
      made.current = [];
      stages.current = {};
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // the phones' bar: once the main Add to bag has scrolled out of view
  useEffect(() => {
    const el = buyRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) =>
      setBar(!!e && !e.isIntersecting && e.boundingClientRect.top < 0),
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const choose = async (k: ShopFormat) => {
    if (k === current.current) return;
    const prev = current.current;
    current.current = k;
    setFmt(k);
    setQty(1);
    const [a, b] = await Promise.all([stageFor(prev), stageFor(k)]);
    if (current.current !== k) return;
    a?.setActive(false);
    b?.setActive(true);
  };

  const onAdd = async () => {
    if (pending || !f.price) return;
    setPending(true);
    flyToBag(posters.current[fmt] ?? null);
    try {
      await add(f.variantId, qty, `${salt.title}, ${f.size}`);
      setQty(1);
    } finally {
      setPending(false);
    }
  };

  const addButton = (extra = '') => (
    <button
      type="button"
      className={`${styles.add} ${extra}`}
      onClick={onAdd}
      disabled={!f.price}
      aria-busy={pending}
    >
      {f.price ? 'Add to bag' : 'Price coming soon'}
      <span className="sr-only">
        : {salt.title}, {f.size}
      </span>
    </button>
  );

  return (
    <div className={styles.top}>
      <div className={styles.stage}>
        <div className={styles.media} data-product-media>
          {keys.map((k) => {
            const r = salt.formats[k]!.render;
            return (
              <div
                key={k}
                className={styles.layer}
                data-on={k === fmt || undefined}
                aria-hidden={k !== fmt}
              >
                <picture className={styles.poster} style={{ opacity: shown[k] ? 0 : 1 }}>
                  <source srcSet={stillSrc(r.name, 'avif')} type="image/avif" />
                  { }
                  <img
                    ref={(el) => {
                      posters.current[k] = el;
                    }}
                    src={stillSrc(r.name, 'webp')}
                    alt={k === fmt && !shown[k] ? r.alt : ''}
                    width={r.width}
                    height={r.height}
                    fetchPriority={k === 'jar' ? 'high' : undefined}
                    loading={k === 'jar' ? 'eager' : 'lazy'}
                    style={{ backgroundImage: `url(${r.blur})` }}
                  />
                </picture>
                {models[k] && (
                  <canvas
                    ref={(el) => {
                      canvases.current[k] = el;
                    }}
                    className={`${styles.gl} ${shown[k] ? styles.glOn : ''}`}
                    tabIndex={k === fmt && shown[k] ? 0 : -1}
                    role="img"
                    aria-label={`${r.alt} in 3D. Drag, or use the left and right arrow keys, to turn it.`}
                  />
                )}
              </div>
            );
          })}
          <span className={styles.ground} aria-hidden="true" />
        </div>
        <button
          type="button"
          className={styles.read}
          aria-haspopup="dialog"
          aria-controls="label-reader"
          onClick={(e) =>
            labelReader.open?.(
              fmt === 'pouch' ? `${salt.handle}:pouch` : salt.handle,
              e.currentTarget,
            )
          }
        >
          Read the label
          <span className="sr-only">
            : {salt.title}, {fmt}
          </span>
        </button>
      </div>

      <div className={styles.details}>
        <p className="py-eyebrow">
          {salt.title}
          {salt.hindi && (
            <>
              {' · '}
              <span lang="hi" className={styles.eyebrowHindi}>
                {salt.hindi}
              </span>
            </>
          )}
        </p>
        <h1 className={`py-display py-d-l ${styles.title}`}>{salt.title}</h1>
        <p className={styles.line}>{salt.line}</p>
        <p className={styles.price} aria-live="polite" data-price>
          {f.price ?? 'Price coming soon'}
          <span className={styles.size}> · {f.size}</span>
        </p>
        {keys.length > 1 && (
          <div className={styles.formats} role="radiogroup" aria-label={`Format, ${salt.title}`}>
            {keys.map((k) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={k === fmt}
                className={styles.format}
                onClick={() => void choose(k)}
                onPointerEnter={() => void stageFor(k)}
              >
                <span>{k === 'jar' ? 'Jar' : 'Pouch'}</span>
                <small>{salt.formats[k]!.price ?? '—'}</small>
              </button>
            ))}
          </div>
        )}
        <div className={styles.buy} ref={buyRef}>
          <div className={styles.stepper} role="group" aria-label={`Quantity, ${salt.title}`}>
            <button
              type="button"
              onClick={() => setQty((q) => Math.max(1, q - 1))}
              disabled={qty <= 1 || !f.price}
              aria-label="Decrease quantity"
            >
              −
            </button>
            <output aria-live="polite" aria-label="Quantity">
              {qty}
            </output>
            <button
              type="button"
              onClick={() => setQty((q) => Math.min(MAX_LINE_QUANTITY, q + 1))}
              disabled={qty >= MAX_LINE_QUANTITY || !f.price}
              aria-label="Increase quantity"
            >
              +
            </button>
          </div>
          {addButton()}
        </div>
        <p className={styles.note}>
          {free ? `Free shipping from ${free} · ` : ''}Cash on delivery available
        </p>
        <p className={styles.note}>Packed at Sambhar · Lab-tested</p>
      </div>

      <div className={styles.bar} data-open={bar || undefined} aria-hidden={!bar}>
        <p className={styles.barPrice}>
          {f.price ?? '—'}
          <span>
            {salt.title}, {f.size}
          </span>
        </p>
        {bar && addButton(styles.barAdd)}
      </div>
    </div>
  );
}
