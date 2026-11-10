import Image from 'next/image';
import Link from 'next/link';
import { HindiText } from '@/components/HindiText/HindiText';
import { PhotoPlaceholder } from '@/components/PhotoPlaceholder/PhotoPlaceholder';
import { isPurchasable, type Product } from '@/lib/commerce';
import { formatPrice } from '@/lib/format';
import styles from './ProductCard.module.css';
import { AddToCartButton } from './AddToCartButton';

interface ProductCardProps {
  product: Product;
  /** Navy card (used for The Sambhar Pair). */
  featured?: boolean;
  /** Gold tag, shown only when the product has a price. */
  tag?: string;
}

/**
 * The whole card opens the product page (stretched title link); the Add to cart button sits
 * above that link so both stay real, separately focusable elements.
 */
export function ProductCard({ product, featured = false, tag }: ProductCardProps) {
  const variant = product.variants[0];
  if (!variant) return null;
  const purchasable = isPurchasable(variant);
  const href = `/product/${product.handle}`;
  const tone = featured ? 'dark' : 'light';

  return (
    <article className={`${styles.card} ${featured ? styles.featured : ''}`}>
      <div className={styles.inner}>
        <div className={styles.media}>
          {product.featuredImage ? (
            <Image
              src={product.featuredImage.url}
              alt={product.featuredImage.alt}
              width={product.featuredImage.width}
              height={product.featuredImage.height}
              sizes="(max-width: 700px) 100vw, (max-width: 1100px) 50vw, 400px"
              className={styles.image}
            />
          ) : (
            <PhotoPlaceholder subject={`${product.title} jar`} tone={tone} ratio="auto" />
          )}
          {tag && variant.price && <span className={styles.tag}>{tag}</span>}
        </div>

        <div className={styles.body}>
          <p className={styles.hindi}>
            {product.titleHindi ? <HindiText>{product.titleHindi}</HindiText> : '\u00a0'}
          </p>
          <h3 className={styles.title}>
            <Link href={href} className={styles.link}>
              {product.title}
            </Link>
          </h3>
          <p className={styles.summary}>{product.summary}</p>
          <p className={styles.meta}>
            <span className={styles.price}>{formatPrice(variant.price)}</span>
            <span className={styles.size}>{variant.title}</span>
          </p>
          <AddToCartButton
            variantId={variant.id}
            purchasable={purchasable}
            productTitle={product.title}
            variant={featured ? 'primary' : 'dark'}
            className={styles.cta}
          />
        </div>
      </div>
    </article>
  );
}
