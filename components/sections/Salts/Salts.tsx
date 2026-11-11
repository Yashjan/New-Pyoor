import { Horizon } from '@/components/Horizon/Horizon';
import { ProductFeature } from '@/components/ProductFeature/ProductFeature';
import { SplitText } from '@/components/SplitText/SplitText';
import type { Product } from '@/lib/commerce';
import shell from '../section.module.css';
import styles from './Salts.module.css';
import { asset } from '@/lib/basePath';

/** The two launch salts, one at a time, alternating sides. */
export function Salts({ black, lake }: { black: Product | null; lake: Product | null }) {
  return (
    <section className={shell.blk} id="shop" aria-labelledby="shop-title">
      <div className="py-wrap">
        <div className={styles.head}>
          <p className="py-eyebrow">The salts</p>
          <SplitText id="shop-title" className="py-display py-d-l">
            Two salts. One lake.
          </SplitText>
          <Horizon draw className={styles.horizon} />
        </div>
        <div className={styles.prods}>
          {black && (
            <ProductFeature
              product={black}
              render={{
                src: asset('/images/renders/jar-black.webp'),
                alt: 'Pyoor Herbal Black Salt, 1 kg jar',
              }}
              tag="Herbal black salt"
              taste="Sulphurous and tangy, with the distinct aroma of kala namak. Made for chaat, raita, fruit, chaas and nimbu pani."
              meta="Made from Sambhar Lake salt with harad, baheda and amla · 1 kg jar · Best before 24 months from manufacture"
            />
          )}
          {lake && (
            <ProductFeature
              reverse
              product={lake}
              render={{
                src: asset('/images/renders/jar-lake.webp'),
                alt: 'Pyoor Natural Lake Salt, 1 kg jar',
              }}
              tag="Natural lake salt"
              taste="A clean, bright saltiness for everyday cooking: dal, sabzi, rotis and baking."
              meta="Harvested from Sambhar Lake and sun-dried · 1 kg jar · Best before 24 months from manufacture"
            />
          )}
        </div>
      </div>
    </section>
  );
}
