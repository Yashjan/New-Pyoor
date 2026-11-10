import { getFreeShippingThreshold } from '@/lib/commerce';
import { formatPrice } from '@/lib/format';
import styles from './AnnouncementBar.module.css';

/** Top strip. The free-shipping message only appears once a threshold is set in pricing.ts. */
export function AnnouncementBar() {
  const threshold = getFreeShippingThreshold();
  const messages = [
    threshold && `Free shipping above ${formatPrice(threshold)}`,
    'Cash on delivery available',
    'Packed at Sambhar Lake',
  ].filter((m): m is string => Boolean(m));

  return (
    <aside className={styles.bar} aria-label="Store information">
      <p className={styles.text}>
        {messages.map((message, i) => (
          <span key={message}>
            {i > 0 && (
              <span className={styles.sep} aria-hidden="true">
                ·
              </span>
            )}
            {message}
          </span>
        ))}
      </p>
    </aside>
  );
}
