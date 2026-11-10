import { ProductCard } from '@/components/ProductCard/ProductCard';
import { SectionHeading } from '@/components/SectionHeading/SectionHeading';
import type { Product } from '@/lib/commerce';
import styles from './Collection.module.css';

export function Collection({ products }: { products: Product[] }) {
  return (
    <section id="shop" className={styles.section} aria-labelledby="shop-title">
      <div className="container">
        <SectionHeading
          id="shop-title"
          tone="light"
          eyebrow="The collection"
          title="Two salts. One lake."
          intro="Both begin as brine in the pans of Sambhar Lake. One stays white and clean; the other is slow-crafted into kala namak."
        />
        <div className={styles.gridWrap}>
          <ul className={styles.grid}>
            {products.map((product) => {
              const isBundle = Boolean(product.bundle?.length);
              return (
                <li key={product.id} className={isBundle ? styles.wide : undefined} data-reveal>
                  <ProductCard
                    product={product}
                    featured={isBundle}
                    tag={isBundle ? 'Best value' : undefined}
                  />
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}
