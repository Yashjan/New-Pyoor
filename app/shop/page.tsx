import type { Metadata } from 'next';
import Link from 'next/link';
import { ShopGrid } from '@/components/shop/ShopGrid';
import styles from '@/components/shop/Shop.module.css';
import { SplitText } from '@/components/SplitText/SplitText';
import { shopSalts } from '@/lib/commerce/shop';

export const metadata: Metadata = {
  title: 'Shop the salts',
  description:
    'Herbal Black Salt, Natural Lake Salt and Pink Rock Salt from Pyoor: 1 kg jars and refill pouches, chosen, checked and packed at Sambhar Lake. Cash on delivery.',
  alternates: { canonical: '/shop' },
  openGraph: {
    title: 'The Salts · Pyoor',
    description: 'Salt from Sambhar, chosen, checked and packed by us.',
  },
};

/** /shop: the salts, filterable by salt and by pack (?salt=…&format=…). No WebGL here. */
export default async function ShopPage() {
  const salts = await shopSalts();
  return (
    <main id="main" className={styles.main}>
      <div className="py-wrap">
        <header className={styles.head}>
          <p className="py-eyebrow">Shop</p>
          <SplitText as="h1" className={`py-display py-d-l ${styles.rise}`}>
            The Salts.
          </SplitText>
          <p className={styles.lead}>Salt from Sambhar, chosen, checked and packed by us.</p>
        </header>
        <ShopGrid salts={salts} />
        <div className={styles.promise}>
          <ul aria-label="Our promise">
            <li>Lab-tested</li>
            <li>Checked by batch</li>
            <li>Packed at Sambhar</li>
            <li>Cash on delivery</li>
          </ul>
          <Link className={styles.more} href="/recipes">
            Cook with them <span aria-hidden="true">→</span>
          </Link>
        </div>
      </div>
    </main>
  );
}
