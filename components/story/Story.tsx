import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ReactNode } from 'react';
import { Engraving } from '@/components/Engraving/Engraving';
import { SaltStrip } from '@/components/recipes/SaltStrip';
import { stripSalts } from '@/lib/content/strip';
import { LETTER, type Chapter as ChapterData } from '@/lib/content/story';
import { StoryProgress, type Mark } from './StoryProgress';
import styles from './Story.module.css';

export { styles as storyStyles };

/** The page's opening: eyebrow, headline, one line. */
export function StoryIntro({
  eyebrow,
  title,
  lead,
}: {
  eyebrow: string;
  title: string;
  lead: string;
}) {
  return (
    <header className={styles.intro} data-fade>
      <p className="py-eyebrow">{eyebrow}</p>
      <h1 className="py-display py-d-l">{title}</h1>
      <p className={styles.lead}>
        {lead}
      </p>
    </header>
  );
}

/**
 * One chapter: its engraving (draws itself once as it enters view) and its number, title and
 * words (fade up once). Engraving left, then right, alternating; stacked on phones. A chapter
 * with no plate (or `wide`) is one centred column, with `children` under its words.
 */
export function StoryChapter({
  chapter,
  num,
  children,
  wide,
  textFirst,
}: {
  chapter: ChapterData;
  num: number;
  children?: ReactNode;
  wide?: ReactNode;
  /** with `wide`: the words above it (the letter) rather than under it */
  textFirst?: boolean;
}) {
  const n = String(num).padStart(2, '0');
  const single = !chapter.art || wide;
  return (
    <li
      id={chapter.id}
      className={`${styles.chapter} ${single ? styles.single : ''}`}
      aria-labelledby={`${chapter.id}-title`}
    >
      {chapter.art && !wide && (
        <div className={styles.art}>
          <Engraving name={chapter.art.name} label={chapter.art.label} ratio={chapter.art.ratio} />
        </div>
      )}
      {!textFirst && wide}
      <div className={styles.text} data-fade>
        <span className={styles.num} aria-hidden="true">
          {n}
        </span>
        <h2 id={`${chapter.id}-title`} className="py-display py-d-m">
          {chapter.title}
        </h2>
        {chapter.body.map((t, i) => (
          <p key={i} className={styles.body}>
            {t}
          </p>
        ))}
        {children}
      </div>
      {textFirst && wide}
    </li>
  );
}

/** The chapters' marks for the progress line and the phones' bar. */
export function StoryNav({ marks }: { marks: Mark[] }) {
  return <StoryProgress marks={marks} />;
}

/** "Shop the salt": the two salts' rows (still image, Jar · Pouch, price, Add to bag). */
export async function ShopStrip() {
  const salts = await stripSalts(['herbal-black-salt', 'natural-lake-salt'], { stills: true });
  return (
    <section className={styles.shop} aria-labelledby="shop-title" data-shop-strip>
      <div className={styles.shopHead}>
        <p className="py-eyebrow">From Sambhar</p>
        <h2 id="shop-title" className="py-display py-d-m">
          Shop the salt
        </h2>
      </div>
      <SaltStrip salts={salts} />
    </section>
  );
}

/** The founder's signature (public/brand/signature.svg), inlined. */
const SIGNATURE = readFileSync(join(process.cwd(), 'public/brand/signature.svg'), 'utf8').replace(
  / role="img"| aria-label="[^"]*"/g,
  ' aria-hidden="true"',
);

/** The founder's letter, open and signed (the homepage's, without its envelope). */
export function Letter() {
  return (
    <article className={styles.letter} aria-label="A letter from Sambhar" data-fade>
      <p className={styles.place}>
        {LETTER.place}
        <span lang="hi">सांभर</span>
      </p>
      {LETTER.paragraphs.map((t, i) => (
        <p key={i} className={styles.note}>
          {t}
        </p>
      ))}
      <div
        className={styles.signature}
        role="img"
        aria-label="Yash Jangid signature"
        dangerouslySetInnerHTML={{ __html: SIGNATURE }}
      />
      <p className={styles.byline}>{LETTER.byline}</p>
      <p className={styles.ps}>{LETTER.ps}</p>
    </article>
  );
}
