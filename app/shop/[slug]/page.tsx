import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { LabelReader } from '@/components/LabelReader/LabelReader';
import { RecipeCards } from '@/components/recipes/RecipeCard';
import { ProductView } from '@/components/shop/ProductView';
import { ShopCard } from '@/components/shop/ShopCard';
import styles from '@/components/shop/Product.module.css';
import { getFreeShippingThreshold, getProduct } from '@/lib/commerce';
import { shopHref, shopSalts } from '@/lib/commerce/shop';
import { RECIPES } from '@/lib/content/recipes';
import { formatPrice } from '@/lib/format';
import { breadcrumbLd, ldScript, productLd } from '@/lib/jsonLd';
import { modelUrl } from '@/lib/three/models';

type Params = { slug: string };

export async function generateStaticParams(): Promise<Params[]> {
  return (await shopSalts()).map((s) => ({ slug: s.handle }));
}

// only the shop's salts exist; anything else (the Pair, unpublished products) is a 404
export const dynamicParams = false;

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const product = await getProduct((await params).slug);
  if (!product) return {};
  return {
    title: product.seo.title,
    description: product.seo.description,
    alternates: { canonical: shopHref(product.handle) },
    openGraph: {
      type: 'website',
      title: `${product.title} · Pyoor`,
      description: product.seo.description,
    },
  };
}

/** The label's rows: ingredients, iodised (where it is), net weight, licence, storage. */
function labelRows(facts: { label: string; value: string }[]) {
  const get = (l: string) => facts.find((f) => f.label === l)?.value;
  return [
    ['Ingredients', get('Ingredients')],
    ['Iodised', get('Iodised') === 'Yes' ? 'Yes' : undefined],
    ['Net weight', get('Net weight') ?? '1 kg'],
    ['FSSAI Lic. No.', get('FSSAI Lic. No.')],
    ['Storage', get('Storage') ?? 'Store in a cool, dry place. Close the pack after use.'],
    ['Packed by', get('Packed by')],
    ['Batch and dates', 'Batch and dates printed on the pack'],
  ].filter((r): r is [string, string] => !!r[1]);
}

export default async function ProductPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const [product, salts] = await Promise.all([getProduct(slug), shopSalts()]);
  const salt = salts.find((s) => s.handle === slug);
  if (!product || !salt) notFound();
  const free = getFreeShippingThreshold();
  const recipes = RECIPES.filter((r) => (r.salts as string[]).includes(slug));
  const others = salts.filter((s) => s.handle !== slug).slice(0, 2);
  const images = Object.values(salt.formats).map(
    (f) => `/images/renders/${f!.render.name}-studio.webp`,
  );
  const ld = [
    productLd(product, images),
    breadcrumbLd([
      ['Home', '/'],
      ['Shop', '/shop'],
      [product.title, shopHref(slug)],
    ]),
  ];

  return (
    <main id="main" className={styles.main}>
      {ld.map((d, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: ldScript(d) }}
        />
      ))}
      <div className="py-wrap">
        <nav aria-label="Breadcrumb">
          <ol className={styles.crumbs}>
            <li>
              <Link href="/">Home</Link>
            </li>
            <li>
              <Link href="/shop">Shop</Link>
            </li>
            <li aria-current="page">{product.title}</li>
          </ol>
        </nav>

        <ProductView
          salt={salt}
          models={{
            jar: product.model ?? undefined,
            pouch: salt.formats.pouch ? modelUrl(`pyoor-pouch-${slug}.glb`) : undefined,
          }}
          free={free ? formatPrice(free) : null}
        />

        {product.about && (
          <section className={styles.section} aria-labelledby="about">
            <h2 id="about" className="py-display py-d-m">
              About this salt
            </h2>
            <div className={styles.prose}>
              {product.about.map((t, i) => (
                <p key={i}>{t}</p>
              ))}
            </div>
          </section>
        )}

        {product.uses && (
          <section className={styles.section} aria-labelledby="use">
            <h2 id="use" className="py-display py-d-m">
              How to use it
            </h2>
            <ul className={styles.uses}>
              {product.uses.map((t, i) => (
                <li key={i}>{t}</li>
              ))}
            </ul>
          </section>
        )}

        <section className={styles.section} aria-labelledby="label">
          <h2 id="label" className="py-display py-d-m">
            Ingredients &amp; label
          </h2>
          <dl className={styles.facts}>
            {labelRows(product.facts).map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        </section>

        {recipes.length > 0 && (
          <section className={styles.section} aria-labelledby="recipes">
            <h2 id="recipes" className="py-display py-d-m">
              Recipes with this salt
            </h2>
            <RecipeCards recipes={recipes} />
          </section>
        )}

        {others.length > 0 && (
          <section className={styles.section} aria-labelledby="others">
            <h2 id="others" className="py-display py-d-m">
              The other salts
            </h2>
            <ul className={styles.others}>
              {others.map((s) => (
                <ShopCard key={s.handle} salt={s} as="h3" />
              ))}
            </ul>
          </section>
        )}
      </div>
      <LabelReader cta={false} />
    </main>
  );
}
