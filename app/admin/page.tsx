import type { Metadata } from 'next';
import { Admin } from '@/components/admin/Admin';
import styles from '@/components/checkout/Checkout.module.css';

export const metadata: Metadata = {
  title: 'Orders',
  robots: { index: false, follow: false },
};

export default function AdminPage() {
  return (
    <main id="main" className={styles.main}>
      <div className={styles.wrap}>
        <header className={styles.head}>
          <p className="py-eyebrow">Admin</p>
          <h1 className="py-display py-d-l">Orders</h1>
        </header>
        <Admin />
      </div>
    </main>
  );
}
