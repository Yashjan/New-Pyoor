import Image from 'next/image';
import { ButtonLink, Button } from '@/components/Button/Button';
import { HindiText } from '@/components/HindiText/HindiText';
import { SplitText } from '@/components/SplitText/SplitText';
import { isPurchasable, type Product } from '@/lib/commerce';
import { formatPrice } from '@/lib/format';
import { AddToBagButton } from './AddToBagButton';
import styles from './ProductFeature.module.css';

interface ProductFeatureProps {
  product: Product;
  /** Transparent jar render (public/images/renders). */
  render: { src: string; alt: string };
  /** Small uppercase tag on the panel, e.g. "Herbal black salt". */
  tag: string;
  /** One sentence of taste and use. */
  taste: string;
  /** Facts line: ingredients · size · shelf life. */
  meta: string;
  /** Image on the right instead of the left. */
  reverse?: boolean;
}

/**
 * The product as an object (design-system/component-ProductFeature.md): a large jar render on
 * a surface-alt panel, the Hindi and English names, one line of taste and use, facts, then
 * price and "Add to bag". No price yet: a disabled "Price coming soon" button instead.
 */
export function ProductFeature({
  product,
  render,
  tag,
  taste,
  meta,
  reverse,
}: ProductFeatureProps) {
  const variant = product.variants[0];
  if (!variant) return null;
  const purchasable = isPurchasable(variant);

  return (
    <article className={`${styles.feature} ${reverse ? styles.rev : ''}`}>
      <div className={styles.media} data-clip-reveal>
        <span className={`py-eyebrow ${styles.tag}`}>{tag}</span>
        <Image
          src={render.src}
          alt={render.alt}
          width={1206}
          height={1570}
          sizes="(max-width: 860px) 58vw, 380px"
          className={styles.img}
          data-float
        />
      </div>
      <div className={styles.body}>
        {product.titleHindi && (
          <div className={`py-hindi ${styles.hindi}`}>
            <HindiText>{product.titleHindi}</HindiText>
          </div>
        )}
        <SplitText as="h3" className="py-display py-d-l">
          {product.title}
        </SplitText>
        <p className={styles.desc} data-fade>
          {taste}
        </p>
        <div className={styles.meta} data-fade>
          {meta}
        </div>
        <div className={styles.buy} data-fade>
          {purchasable ? (
            <>
              <span className="py-price">
                {formatPrice(variant.price)}
                <small className={styles.size}>1 kg</small>
              </span>
              <AddToBagButton variantId={variant.id} productTitle={product.title} />
              <ButtonLink variant="link" href={`/product/${product.handle}`}>
                Details<span className="sr-only">: {product.title}</span>
              </ButtonLink>
            </>
          ) : (
            <>
              <span className={styles.sizeOnly}>1 kg jar</span>
              <Button disabled>Price coming soon</Button>
            </>
          )}
        </div>
      </div>
    </article>
  );
}
