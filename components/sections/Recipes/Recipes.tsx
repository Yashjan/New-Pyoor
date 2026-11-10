import Link from 'next/link';
import { ButtonLink } from '@/components/Button/Button';
import { Placeholder } from '@/components/Placeholder/Placeholder';
import { SplitText } from '@/components/SplitText/SplitText';
import shell from '../section.module.css';
import styles from './Recipes.module.css';

const RECIPES = [
  {
    title: 'Street-style chaat',
    shot: 'Papdi chaat, close-up',
    meta: 'Herbal Black Salt · 10 min',
  },
  { title: 'Shikanji', shot: 'Nimbu pani in a glass', meta: 'Herbal Black Salt · 5 min' },
  { title: 'Everyday dal tadka', shot: 'Dal tadka, top-down', meta: 'Natural Lake Salt · 30 min' },
];

/** Recipe pages come later: links point back to this section for now. */
export function Recipes() {
  return (
    <section className={shell.blk} id="recipes" aria-labelledby="recipes-title">
      <div className="py-wrap">
        <div className={styles.head}>
          <div className={styles.headTitle}>
            <p className="py-eyebrow">At the table</p>
            <SplitText id="recipes-title" className="py-display py-d-l">
              A pinch, and it’s done.
            </SplitText>
          </div>
          <ButtonLink variant="link" href="/#recipes">
            All recipes
          </ButtonLink>
        </div>
        <ul className={styles.recipes}>
          {RECIPES.map((r) => (
            <li key={r.title}>
              <Link className={styles.rec} href="/#recipes">
                <Placeholder shot={r.shot} ratio="4 / 5" className={styles.ph} />
                <h3 className={`py-display ${styles.title}`}>{r.title}</h3>
                <span>{r.meta}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
