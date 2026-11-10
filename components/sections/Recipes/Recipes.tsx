import Link from 'next/link';
import { PhotoPlaceholder } from '@/components/PhotoPlaceholder/PhotoPlaceholder';
import { SectionHeading } from '@/components/SectionHeading/SectionHeading';
import styles from './Recipes.module.css';

const RECIPES = [
  { title: 'Street-style chaat', salt: 'Black Salt', time: '10 min', photo: 'street-style chaat' },
  {
    title: 'Shikanji / nimbu pani',
    salt: 'Black Salt',
    time: '5 min',
    photo: 'shikanji, nimbu pani',
  },
  { title: 'Everyday dal tadka', salt: 'Lake Salt', time: '30 min', photo: 'dal tadka' },
];

export function Recipes() {
  return (
    <section id="recipes" className={styles.section} aria-labelledby="recipes-title">
      <div className="container">
        <SectionHeading id="recipes-title" eyebrow="Recipes" title="A pinch, and it’s done" />
        <ul className={styles.grid}>
          {RECIPES.map((r) => (
            <li key={r.title} data-reveal>
              {/* Recipe pages come later; links are placeholders for now. */}
              <Link href="#" className={styles.card}>
                <PhotoPlaceholder subject={r.photo} ratio="4 / 3" />
                <span className={styles.meta}>
                  {r.salt} · {r.time}
                </span>
                <h3 className={styles.title}>{r.title}</h3>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
