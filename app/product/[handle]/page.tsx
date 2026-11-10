import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { HindiText } from '@/components/HindiText/HindiText';
import { getProduct, getProducts } from '@/lib/commerce';
import { formatPrice } from '@/lib/format';

/** Step 1 skeleton: proves routing + the commerce layer. Full page is built in Step 4. */

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
    <main id="main" className="container" style={{ paddingBlock: 'var(--section-pad-y)' }}>
      <h1 style={{ textTransform: 'uppercase', fontSize: 'var(--text-3xl)' }}>{product.title}</h1>
      {product.titleHindi && (
        <p>
          <HindiText>{product.titleHindi}</HindiText>
        </p>
      )}
      <p>{product.summary}</p>
      {variant && (
        <p>
          {formatPrice(variant.price)} · {variant.title}
        </p>
      )}
    </main>
  );
}
