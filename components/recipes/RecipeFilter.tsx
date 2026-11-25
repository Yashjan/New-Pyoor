'use client';

import { useState, type ReactNode } from 'react';
import { SALT_NAMES, type SaltHandle } from '@/lib/content/recipes';
import styles from './RecipeFilter.module.css';

const CHIPS: (SaltHandle | 'all')[] = ['all', 'herbal-black-salt', 'natural-lake-salt'];

/**
 * All · Herbal Black Salt · Natural Lake Salt: shows the cards that use that salt (CSS, on the
 * cards' data-salts). Without JS every card shows and the chips are not rendered as active.
 */
export function RecipeFilter({
  counts,
  children,
}: {
  counts: Record<string, number>;
  children: ReactNode;
}) {
  const [salt, setSalt] = useState<SaltHandle | 'all'>('all');
  return (
    <div className={styles.filter} data-filter={salt}>
      <div className={styles.chips} role="group" aria-label="Show recipes with">
        {CHIPS.map((k) => (
          <button
            key={k}
            type="button"
            className={styles.chip}
            aria-pressed={salt === k}
            onClick={() => setSalt(k)}
          >
            {k === 'all' ? 'All' : SALT_NAMES[k]}
          </button>
        ))}
      </div>
      <p className="sr-only" aria-live="polite">
        {counts[salt]} recipes
      </p>
      {children}
    </div>
  );
}
