import type { Metadata } from 'next';
import { RecipeCards } from '@/components/recipes/RecipeCard';
import { RecipeFilter } from '@/components/recipes/RecipeFilter';
import styles from '@/components/recipes/Recipe.module.css';
import { RECIPES } from '@/lib/content/recipes';

export const metadata: Metadata = {
  title: 'Recipes',
  description:
    'Simple things made with Pyoor salt: nimbu pani, fruit chaat, masala chaas, jaljeera, aloo chaat and kachumber salad.',
  alternates: { canonical: '/recipes' },
};

const counts = {
  all: RECIPES.length,
  'herbal-black-salt': RECIPES.filter((r) => r.salts.includes('herbal-black-salt')).length,
  'natural-lake-salt': RECIPES.filter((r) => r.salts.includes('natural-lake-salt')).length,
};

export default function RecipesPage() {
  return (
    <main id="main" className={styles.main}>
      <div className="py-wrap">
        <header className={`${styles.indexHead} ${styles.indexHero}`}>
          <p className="py-eyebrow">From our kitchen</p>
          <h1 className="py-display py-d-l">Simple things, made with salt.</h1>
        </header>
        <RecipeFilter counts={counts}>
          <RecipeCards recipes={RECIPES} layout="grid" as="h2" />
        </RecipeFilter>
      </div>
    </main>
  );
}
