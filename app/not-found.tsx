import type { Metadata } from 'next';
import Link from 'next/link';
import styles from './not-found.module.css';

export const metadata: Metadata = {
  title: 'Page not found',
  robots: { index: false },
};

/** 404: the gold horizon with the sun half set on it, a line, and the way back. */
export default function NotFound() {
  return (
    <main id="main" className={styles.main}>
      <svg className={styles.sun} viewBox="0 0 240 64" aria-hidden="true">
        <path d="M0 63.5 H240" />
        <path d="M88 63.5 A32 32 0 0 1 152 63.5" />
      </svg>
      <p className="py-eyebrow">404</p>
      <h1 className={`py-display py-d-l ${styles.title}`}>This path leads off the lake.</h1>
      <p className={styles.lead}>The page you were looking for isn’t here.</p>
      <p className={styles.links}>
        <Link href="/">Home</Link>
        <Link href="/#shop">Shop the salts</Link>
      </p>
    </main>
  );
}
