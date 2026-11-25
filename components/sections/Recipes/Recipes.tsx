import { ButtonLink } from '@/components/Button/Button';
import { RecipeCards } from '@/components/recipes/RecipeCard';
import { SplitText } from '@/components/SplitText/SplitText';
import { RECIPES } from '@/lib/content/recipes';
import shell from '../section.module.css';
import styles from './Recipes.module.css';

/** 07 · Recipes: the first three cards from lib/content/recipes.ts, each linking to its page. */
export function Recipes() {
  return (
    <section className={shell.blk} id="recipes" aria-labelledby="recipes-title">
      <div className="py-wrap">
        <div className={styles.head}>
          <div className={styles.headTitle}>
            <p className="py-eyebrow">07 · Recipes</p>
            <SplitText id="recipes-title" className="py-display py-d-l">
              From our kitchen.
            </SplitText>
            {/* [CONFIRM] */}
            <p className={styles.lead}>Simple things we make at home with our salt.</p>
          </div>
          <ButtonLink variant="link" href="/recipes">
            All recipes →
          </ButtonLink>
        </div>
        <RecipeCards recipes={RECIPES.slice(0, 3)} />
      </div>
    </section>
  );
}
