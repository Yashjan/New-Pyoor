'use client';

import { useEffect, useState } from 'react';
import type { SaltKey, ShopFormat, ShopSalt } from '@/lib/commerce/shop';
import { ShopCard } from './ShopCard';
import styles from './Shop.module.css';

type Filter = { salt: SaltKey | null; format: ShopFormat | null };

const CHIPS: { label: string; set: Partial<Filter> | null }[] = [
  { label: 'All', set: null },
  { label: 'Herbal Black Salt', set: { salt: 'black' } },
  { label: 'Natural Lake Salt', set: { salt: 'lake' } },
  { label: 'Pink Rock Salt', set: { salt: 'pink' } },
  { label: 'Jars', set: { format: 'jar' } },
  { label: 'Pouches', set: { format: 'pouch' } },
];
const SALT_KEYS: readonly string[] = ['black', 'lake', 'pink'];
const FORMATS: readonly string[] = ['jar', 'pouch'];

function fromUrl(): Filter {
  const q = new URLSearchParams(window.location.search);
  const salt = q.get('salt');
  const format = q.get('format');
  return {
    salt: salt && SALT_KEYS.includes(salt) ? (salt as SaltKey) : null,
    format: format && FORMATS.includes(format) ? (format as ShopFormat) : null,
  };
}

function toUrl(f: Filter) {
  const q = new URLSearchParams();
  if (f.salt) q.set('salt', f.salt);
  if (f.format) q.set('format', f.format);
  const s = q.toString();
  return `${window.location.pathname}${s ? `?${s}` : ''}`;
}

/** Whether a salt shows under a filter: its salt, and the format in stock. */
const shows = (s: ShopSalt, f: Filter) =>
  (!f.salt || s.key === f.salt) && (!f.format || !!s.formats[f.format]?.price);

/**
 * The chips and the grid. The filter lives in the URL (?salt=black|lake|pink&format=jar|pouch),
 * so it can be shared; a chip changes it without a reload (history.pushState). Rendered
 * complete on the server (all salts); the URL's filter applies once hydrated.
 */
export function ShopGrid({ salts }: { salts: ShopSalt[] }) {
  const [f, setF] = useState<Filter>({ salt: null, format: null });

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the URL is read after hydration
    setF(fromUrl());
    const onPop = () => setF(fromUrl());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const pick = (set: Partial<Filter> | null) => {
    const next: Filter = set ? { ...f, ...set } : { salt: null, format: null };
    // a chip that is on turns off
    if (set?.salt && f.salt === set.salt) next.salt = null;
    if (set?.format && f.format === set.format) next.format = null;
    setF(next);
    window.history.pushState(null, '', toUrl(next));
  };
  const active = (set: Partial<Filter> | null) =>
    set
      ? (set.salt != null && f.salt === set.salt) || (set.format != null && f.format === set.format)
      : !f.salt && !f.format;
  const visible = salts.filter((s) => shows(s, f));

  return (
    <>
      <nav className={styles.chips} aria-label="Filter the salts">
        {CHIPS.map((c) => (
          <button
            key={c.label}
            type="button"
            className={styles.chip}
            aria-pressed={active(c.set)}
            onClick={() => pick(c.set)}
          >
            {c.label}
          </button>
        ))}
      </nav>
      <ul className={styles.grid} aria-live="polite">
        {salts.map((s) => (
          <ShopCard key={s.handle} salt={s} format={f.format ?? undefined} hidden={!shows(s, f)} />
        ))}
      </ul>
      {visible.length === 0 && (
        <div className={styles.empty} role="status">
          <p>Nothing here just now: that salt doesn’t come in that pack yet.</p>
          <button type="button" className={styles.chip} onClick={() => pick(null)}>
            See all salts
          </button>
        </div>
      )}
    </>
  );
}
