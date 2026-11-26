import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Confirmation } from '@/components/checkout/Confirmation';
import styles from '@/components/checkout/Checkout.module.css';
import { Engraving } from '@/components/Engraving/Engraving';

export const metadata: Metadata = {
  title: 'Thank you',
  robots: { index: false, follow: false },
};

export default function OrderPage() {
  return (
    <main id="main" className={styles.main}>
      <div className={`${styles.wrap} ${styles.narrow}`}>
        <header className={styles.head}>
          <p className="py-eyebrow">Order placed</p>
          <h1 className="py-display py-d-l">Thank you.</h1>
          <Engraving name="page-thanks" label="" className={styles.art} ratio="640 / 300" />
        </header>
        <Suspense fallback={null}>
          <Confirmation />
        </Suspense>
      </div>
    </main>
  );
}
