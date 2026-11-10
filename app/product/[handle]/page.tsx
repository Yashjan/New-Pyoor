import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { HindiText } from '@/components/HindiText/HindiText';
import { getProduct, getProducts } from '@/lib/commerce';
import { formatPrice } from '@/lib/format';
import styles from './page.module.css';

/** Skeleton: proves routing + the commerce layer. The full product page is built in Step 4. */

type Params = { handle: string };

export async function generateStaticParams(): Promise<Params[]> {
  const products = await getProducts();
  return products.map((p) => ({ handle: p.handle }));
}

// Only published handles exist; anything else (including unpublished products) is a 404.
export const dynamicParams = false;

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const product = await getProduct((await params).handle);
  if (!product) return {};
  return { title: product.seo.title, description: product.seo.description };
}

export default async function ProductPage({ params }: { params: Promise<Params> }) {
  const product = await getProduct((await params).handle);
  if (!product) notFound();
  const variant = product.variants[0];

  return (
    <main id="main" className={styles.main}>
      <div className="py-wrap">
        {product.titleHindi && (
          <p className={`py-hindi ${styles.hindi}`}>
            <HindiText>{product.titleHindi}</HindiText>
          </p>
        )}
        <h1 className="py-display py-d-l">{product.title}</h1>
        <p className="py-lead">{product.description}</p>
        {variant && (
          <p className={styles.meta}>
            <span className="py-price">{formatPrice(variant.price)}</span> · {variant.title}
          </p>
        )}
      </div>
    </main>
  );
}
