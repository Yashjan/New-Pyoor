import Link from 'next/link';
import { Engraving } from '@/components/Engraving/Engraving';
import { recipeMeta, type Recipe } from '@/lib/content/recipes';
import styles from './RecipeCard.module.css';

/** One recipe: its engraving, name, time and salt, and the link (the whole card is the link). */
export function RecipeCard({ recipe, as: H = 'h3' }: { recipe: Recipe; as?: 'h2' | 'h3' }) {
  const id = `recipe-${recipe.slug}`;
  return (
    <article className={styles.card} aria-labelledby={id}>
      <Engraving className={styles.art} name={`recipe-${recipe.slug}`} label={recipe.art} />
      <H id={id} className={`py-display ${styles.name}`}>
        <span className={styles.nameText}>{recipe.name}</span>
      </H>
      <p className={styles.meta}>{recipeMeta(recipe)}</p>
      <Link className={styles.link} href={`/recipes/${recipe.slug}`}>
        Read the recipe <span aria-hidden="true">→</span>
        <span className="sr-only">: {recipe.name}</span>
      </Link>
    </article>
  );
}

/** The cards in a row (desktop); on phones a horizontal swipe with snap, or a grid. */
export function RecipeCards({
  recipes,
  layout = 'row',
  as,
}: {
  recipes: Recipe[];
  layout?: 'row' | 'grid';
  as?: 'h2' | 'h3';
}) {
  return (
    <ul className={`${styles.cards} ${layout === 'grid' ? styles.grid : styles.row}`}>
      {recipes.map((r) => (
        <li key={r.slug} data-salts={r.salts.join(' ')}>
          <RecipeCard recipe={r} as={as} />
        </li>
      ))}
    </ul>
  );
}
