'use client';

import { useState } from 'react';
import { useCart } from '@/components/providers/CartProvider';
import styles from './Recipe.module.css';

export interface StripFormat {
  id: string;
  size: string;
  /** "₹249", or null while the price is not set (not addable) */
  price: string | null;
}

export interface StripSalt {
  handle: string;
  title: string;
  image: { url: string; alt: string };
  jar: StripFormat;
  pouch?: StripFormat;
}

/** The salt a recipe uses: Jar · Pouch, its price, "Add to bag" (the site's bag). */
function SaltRow({ salt }: { salt: StripSalt }) {
  const { add } = useCart();
  const [fmt, setFmt] = useState<'jar' | 'pouch'>('jar');
  const [pending, setPending] = useState(false);
  const f = (fmt === 'pouch' && salt.pouch) || salt.jar;
  const onAdd = async () => {
    if (!f.price || pending) return;
    setPending(true);
    try {
      await add(f.id, 1, `${salt.title}, ${f.size}`);
    } finally {
      setPending(false);
    }
  };
  return (
    <li className={styles.salt} data-salt={salt.handle}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className={styles.saltImg}
        src={salt.image.url}
        alt={salt.image.alt}
        width={96}
        height={96}
        loading="lazy"
      />
      <div className={styles.saltBody}>
        <h3 className={styles.saltName}>{salt.title}</h3>
        {salt.pouch && (
          <div className={styles.formats} role="radiogroup" aria-label={`Format, ${salt.title}`}>
            {(['jar', 'pouch'] as const).map((k, i) => (
              <span key={k}>
                {i > 0 && <span aria-hidden="true"> · </span>}
                <button
                  type="button"
                  role="radio"
                  aria-checked={k === fmt}
                  className={styles.format}
                  onClick={() => setFmt(k)}
                >
                  {k === 'jar' ? 'Jar' : 'Pouch'}
                </button>
              </span>
            ))}
          </div>
        )}
        <p className={styles.saltPrice} aria-live="polite">
          {f.size} · <span className={styles.amount}>{f.price ?? 'Price coming soon'}</span>
        </p>
      </div>
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
    </li>
  );
}

export function SaltStrip({ salts }: { salts: StripSalt[] }) {
  return (
    <ul className={styles.salts}>
      {salts.map((s) => (
        <SaltRow key={s.handle} salt={s} />
      ))}
    </ul>
  );
}
