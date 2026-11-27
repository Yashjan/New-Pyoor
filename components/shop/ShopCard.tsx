'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';
import { useCart } from '@/components/providers/CartProvider';
import { flyToBag } from '@/components/sections/Products/flyToBag';
import { shopHref, stillSrc, type ShopFormat, type ShopSalt } from '@/lib/commerce/shop';
import styles from './Shop.module.css';

/**
 * One salt in the shop: its studio still (jar or pouch), name, Hindi name, one line, Jar · Pouch
 * (switches the still and the price), "Add to bag" (the site's bag, the fly-to-bag arc). The
 * whole card links to the product page; the switch and the button sit above that link.
 */
export function ShopCard({
  salt,
  format,
  as: H = 'h2',
  hidden,
}: {
  salt: ShopSalt;
  /** the format shown first (the shop's format filter) */
  format?: ShopFormat;
  as?: 'h2' | 'h3';
  hidden?: boolean;
}) {
  const { add } = useCart();
  const [chosen, setChosen] = useState<ShopFormat | null>(null);
  const [pending, setPending] = useState(false);
  const imgs = useRef<Partial<Record<ShopFormat, HTMLImageElement | null>>>({});
  const fmt: ShopFormat =
    (chosen ?? format ?? 'jar') === 'pouch' && salt.formats.pouch ? 'pouch' : 'jar';
  const f = salt.formats[fmt]!;
  const id = `card-${salt.handle}`;
  const keys = (['jar', 'pouch'] as const).filter((k) => salt.formats[k]);

  const onAdd = async () => {
    if (!f.price || pending) return;
    setPending(true);
    flyToBag(imgs.current[fmt] ?? null);
    try {
      await add(f.variantId, 1, `${salt.title}, ${f.size}`);
    } finally {
      setPending(false);
    }
  };

  return (
    <li className={styles.item} hidden={hidden} data-card={salt.key}>
      <article className={styles.card} aria-labelledby={id}>
        <div
          className={styles.media}
          style={{ aspectRatio: `${f.render.width} / ${f.render.height}` }}
        >
          {keys.map((k) => {
            const r = salt.formats[k]!.render;
            return (
              <picture key={k} className={styles.pic} data-on={k === fmt || undefined}>
                <source srcSet={stillSrc(r.name, 'avif')} type="image/avif" />
                { }
                <img
                  ref={(el) => {
                    imgs.current[k] = el;
                  }}
                  src={stillSrc(r.name, 'webp')}
                  alt={k === fmt ? r.alt : ''}
                  width={r.width}
                  height={r.height}
                  loading="lazy"
                  decoding="async"
                  style={{ backgroundImage: `url(${r.blur})` }}
                />
              </picture>
            );
          })}
        </div>
        <H id={id} className={`py-display ${styles.name}`}>
          <Link className={styles.link} href={shopHref(salt.handle)}>
            <span className={styles.nameText}>{salt.title}</span>
          </Link>
        </H>
        {salt.hindi && (
          <p className={styles.hindi} lang="hi">
            {salt.hindi}
          </p>
        )}
        <p className={styles.line}>{salt.line}</p>
        {keys.length > 1 && (
          <div className={styles.formats} role="radiogroup" aria-label={`Format, ${salt.title}`}>
            {keys.map((k, i) => (
              <span key={k}>
                {i > 0 && <span aria-hidden="true"> · </span>}
                <button
                  type="button"
                  role="radio"
                  aria-checked={k === fmt}
                  className={styles.format}
                  onClick={() => setChosen(k)}
                >
                  {k === 'jar' ? 'Jar' : 'Pouch'}
                </button>
              </span>
            ))}
          </div>
        )}
        <div className={styles.buy}>
          <p className={styles.price} aria-live="polite">
            <span className="sr-only">{f.size}, price </span>
            {f.price ?? 'Price coming soon'}
          </p>
          <button
            type="button"
            className={styles.add}
            onClick={onAdd}
            disabled={!f.price}
            aria-busy={pending}
          >
            {f.price ? 'Add to bag' : 'Price coming soon'}
            <span className="sr-only">
              : {salt.title}, {f.size}
            </span>
          </button>
        </div>
      </article>
    </li>
  );
}
