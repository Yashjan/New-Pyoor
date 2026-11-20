import type { ReactNode } from 'react';
import styles from './InfoPage.module.css';

/** "Last updated" on every information page. [CONFIRM] before launch. */
export const LAST_UPDATED = '19 November 2026';

/**
 * Shipping, returns, FAQ, privacy, terms and contact: one quiet layout (sand page, the gold
 * horizon, a Cormorant title, Manrope text in a readable measure). Header and footer come from
 * the root layout.
 */
export function InfoPage({
  eyebrow,
  title,
  lead,
  children,
}: {
  eyebrow: string;
  title: string;
  lead?: string;
  children: ReactNode;
}) {
  return (
    <main id="main" className={styles.main}>
      <article className={styles.page} aria-labelledby="info-title">
        <header className={styles.head}>
          <p className="py-eyebrow">{eyebrow}</p>
          <h1 id="info-title" className="py-display py-d-l">
            {title}
          </h1>
          {lead && <p className={styles.lead}>{lead}</p>}
          <p className={styles.updated}>
            Last updated <time>{LAST_UPDATED}</time>
          </p>
        </header>
        <div className={styles.body}>{children}</div>
      </article>
    </main>
  );
}
