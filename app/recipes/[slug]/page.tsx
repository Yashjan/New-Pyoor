import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Engraving } from '@/components/Engraving/Engraving';
import { Ingredients } from '@/components/recipes/Ingredients';
import styles from '@/components/recipes/Recipe.module.css';
import { SaltStrip, type StripSalt } from '@/components/recipes/SaltStrip';
import { asset } from '@/lib/basePath';
import { getProduct } from '@/lib/commerce';
import { RECIPES, SALT_NAMES, getRecipe, type Recipe } from '@/lib/content/recipes';
import { formatPrice } from '@/lib/format';
import { getSiteUrl } from '@/lib/site';

type Params = { slug: string };

export const dynamicParams = false;

export function generateStaticParams(): Params[] {
  return RECIPES.map((r) => ({ slug: r.slug }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const r = getRecipe((await params).slug);
  if (!r) return {};
  const image = asset(`/engravings/recipe-${r.slug}.png`);
  return {
    title: `${r.name}: a recipe`,
    description: r.description,
    alternates: { canonical: `/recipes/${r.slug}` },
    openGraph: {
      type: 'article',
      title: r.name,
      description: r.description,
      images: [{ url: image, width: 1200, height: 1500, alt: r.art }],
    },
  };
}

function jsonLd(r: Recipe) {
  const abs = (p: string) => new URL(asset(p), getSiteUrl()).href;
  return {
    '@context': 'https://schema.org',
    '@type': 'Recipe',
    name: r.name,
    description: r.description,
    image: [abs(`/engravings/recipe-${r.slug}.png`)],
    author: { '@type': 'Organization', name: 'Pyoor' },
    totalTime: `PT${r.minutes}M`,
    recipeYield: `${r.serves} servings`,
    recipeIngredient: r.ingredients,
    recipeInstructions: r.steps.map((text, i) => ({ '@type': 'HowToStep', position: i + 1, text })),
    url: abs(`/recipes/${r.slug}`),
  };
}

async function saltsFor(r: Recipe): Promise<StripSalt[]> {
  const out: StripSalt[] = [];
  for (const handle of r.salts) {
    const p = await getProduct(handle);
    if (!p) continue;
    const fmt = (v: (typeof p.variants)[number]) => ({
      id: v.id,
      size: v.title,
      price: v.price && v.availableForSale ? formatPrice(v.price) : null,
    });
    const [jar, pouch] = p.variants;
    if (!jar) continue;
    out.push({
      handle,
      title: p.title,
      image: { url: p.featuredImage?.url ?? '', alt: p.featuredImage?.alt ?? '' },
      jar: fmt(jar),
      pouch: pouch ? fmt(pouch) : undefined,
    });
  }
  return out;
}

export default async function RecipePage({ params }: { params: Promise<Params> }) {
  const r = getRecipe((await params).slug);
  if (!r) notFound();
  const salts = await saltsFor(r);
  const ld = JSON.stringify(jsonLd(r)).replace(/</g, '\\u003c');

  return (
    <main id="main" className={styles.main}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ld }} />
      <article className={`py-wrap ${styles.recipe}`} aria-labelledby="recipe-title">
        <p className={styles.back}>
          <Link href="/recipes">← All recipes</Link>
        </p>
        <Engraving className={styles.hero} name={`recipe-${r.slug}`} label={r.art} />
        <header className={styles.head}>
          <p className="py-eyebrow">Recipe</p>
          <h1 id="recipe-title" className="py-display py-d-l">
            {r.name}
          </h1>
          {r.aka && <p className={styles.aka}>{r.aka}</p>}
          <dl className={styles.facts}>
            <div>
              <dt>Serves</dt>
              <dd>{r.serves}</dd>
            </div>
            <div>
              <dt>Time</dt>
              <dd>{r.minutes} min</dd>
            </div>
            <div>
              <dt>Salt</dt>
              <dd>{r.salts.map((s) => SALT_NAMES[s]).join(' + ')}</dd>
            </div>
          </dl>
        </header>

        <section className={styles.part} aria-labelledby="ingredients-title">
          <h2 id="ingredients-title" className={`py-display ${styles.partTitle}`}>
            Ingredients
          </h2>
          <Ingredients slug={r.slug} items={r.ingredients} />
        </section>

        <section className={styles.part} aria-labelledby="steps-title">
          <h2 id="steps-title" className={`py-display ${styles.partTitle}`}>
            Steps
          </h2>
          <ol className={styles.steps}>
            {r.steps.map((s, i) => (
              <li key={i}>
                <span className={styles.num} aria-hidden="true">
                  {i + 1}
                </span>
                <p>{s}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className={styles.part} aria-labelledby="salt-title">
          <h2 id="salt-title" className={`py-display ${styles.partTitle}`}>
            The salt in it
          </h2>
          <SaltStrip salts={salts} />
        </section>
      </article>
    </main>
  );
}
