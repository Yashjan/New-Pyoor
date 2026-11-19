import type { Metadata } from 'next';
import { RecipeCards } from '@/components/recipes/RecipeCard';
import styles from '@/components/recipes/Recipe.module.css';
import { RECIPES } from '@/lib/content/recipes';

export const metadata: Metadata = {
  title: 'Recipes',
  description:
    'Simple things we make at home with Pyoor salt: nimbu pani, fruit chaat and masala chaas.',
  alternates: { canonical: '/recipes' },
};

export default function RecipesPage() {
  return (
    <main id="main" className={styles.main}>
      <div className="py-wrap">
        <header className={styles.indexHead}>
          <p className="py-eyebrow">Recipes</p>
          <h1 className="py-display py-d-l">From our kitchen.</h1>
          {/* [CONFIRM] */}
          <p className={styles.lead}>Simple things we make at home with our salt.</p>
        </header>
        <RecipeCards recipes={RECIPES} layout="grid" as="h2" />
      </div>
    </main>
  );
}
