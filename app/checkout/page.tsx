import type { Metadata } from 'next';
import { Checkout } from '@/components/checkout/Checkout';
import styles from '@/components/checkout/Checkout.module.css';

export const metadata: Metadata = {
  title: 'Checkout',
  robots: { index: false, follow: false },
  alternates: { canonical: '/checkout' },
};

export default function CheckoutPage() {
  return (
    <main id="main" className={styles.main}>
      <div className={styles.wrap}>
        <header className={styles.head}>
          <p className="py-eyebrow">Checkout</p>
          <h1 className="py-display py-d-l">Your order</h1>
        </header>
        <Checkout />
      </div>
    </main>
  );
}
