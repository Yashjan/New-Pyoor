'use client';

import { useEffect, useState } from 'react';
import { useCart } from '@/components/providers/CartProvider';
import styles from './BagToast.module.css';

/** "Added to bag · <product>", shown for 2.4s after each add (concept.html toast). */
export function BagToast() {
  const { added } = useCart();
  // The id of the last notice that has timed out; the toast shows while a newer one exists.
  const [expiredId, setExpiredId] = useState(0);
  const on = !!added && added.id !== expiredId;

  useEffect(() => {
    if (!added) return;
    const t = window.setTimeout(() => setExpiredId(added.id), 2400);
    return () => window.clearTimeout(t);
  }, [added]);

  return (
    <div className={`${styles.toast} ${on ? styles.on : ''}`} role="status" aria-live="polite">
      <i aria-hidden="true" />
      <span>{added ? `Added to bag · ${added.label}` : ''}</span>
    </div>
  );
}
