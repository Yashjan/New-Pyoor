'use client';

import Link from 'next/link';
import { useId, useMemo, useState } from 'react';
import { useModalDialog } from '@/components/Dialog/useModalDialog';
import { HindiText } from '@/components/HindiText/HindiText';
import { CloseIcon, SearchIcon } from '@/components/icons/Icons';
import styles from './SearchDialog.module.css';

export interface SearchItem {
  handle: string;
  title: string;
  titleHindi?: string;
  summary: string;
  /** Extra search terms, e.g. "kala namak". */
  keywords: string;
}

const normalise = (s: string) => s.toLowerCase().normalize('NFKD');

/** Client-side product search over the (small) published catalogue. */
export function SearchDialog({
  open,
  onClose,
  items,
}: {
  open: boolean;
  onClose: () => void;
  items: SearchItem[];
}) {
  const ref = useModalDialog(open, onClose);
  const [query, setQuery] = useState('');
  const inputId = useId();

  const results = useMemo(() => {
    const q = normalise(query.trim());
    if (!q) return items;
    return items.filter((item) =>
      normalise(`${item.title} ${item.titleHindi ?? ''} ${item.summary} ${item.keywords}`).includes(
        q,
      ),
    );
  }, [items, query]);

  return (
    <dialog ref={ref} className={styles.dialog} aria-label="Search products">
      <form role="search" className={styles.bar} onSubmit={(e) => e.preventDefault()}>
        <SearchIcon />
        <label htmlFor={inputId} className="visually-hidden">
          Search products
        </label>
        <input
          id={inputId}
          type="search"
          className={styles.input}
          placeholder="Search salts"
          autoComplete="off"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button type="button" className={styles.close} onClick={onClose}>
          <CloseIcon />
          <span className="visually-hidden">Close search</span>
        </button>
      </form>

      <p className="visually-hidden" aria-live="polite">
        {results.length === 1 ? '1 result' : `${results.length} results`}
      </p>

      {results.length > 0 ? (
        <ul className={styles.results}>
          {results.map((item) => (
            <li key={item.handle}>
              <Link href={`/product/${item.handle}`} onClick={onClose} className={styles.result}>
                <span className={styles.resultTitle}>
                  {item.title}
                  {item.titleHindi && (
                    <>
                      {' '}
                      <HindiText>{item.titleHindi}</HindiText>
                    </>
                  )}
                </span>
                <span className={styles.resultSummary}>{item.summary}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.none}>No salts match “{query}”.</p>
      )}
    </dialog>
  );
}
