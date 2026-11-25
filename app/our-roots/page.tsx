import type { Metadata } from 'next';
import { Engraving } from '@/components/Engraving/Engraving';
import {
  Letter,
  ShopStrip,
  StoryChapter,
  StoryIntro,
  StoryNav,
  storyStyles as styles,
} from '@/components/story/Story';
import { CHECKS, ROOTS, ROOTS_INTRO } from '@/lib/content/story';
import { site } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Our roots',
  description:
    'Pyoor was born on the shores of Sambhar Lake: a lake, an engineer who has built salt refineries since 2003, and his son. Every jar is checked and packed at Sambhar.',
  alternates: { canonical: '/our-roots' },
  openGraph: { title: 'Our roots · Pyoor', description: 'Born on the shores of Sambhar.' },
};

/** /our-roots: "Born on the shores of Sambhar." Seven chapters, engraved; the letter; the shop. */
export default function OurRootsPage() {
  const marks = ROOTS.map((c, i) => ({
    id: c.id,
    num: String(i + 1).padStart(2, '0'),
    title: c.title,
  }));
  return (
    <main id="main" className={styles.main}>
      <StoryNav marks={marks} />
      <StoryIntro {...ROOTS_INTRO} />
      <ol className={styles.chapters}>
        {ROOTS.map((c, i) => {
          const num = i + 1;
          if (c.id === 'what-we-check')
            return (
              <StoryChapter key={c.id} chapter={c} num={num}>
                <ul className={styles.checks}>
                  {CHECKS.map((k) => (
                    <li key={k.name}>
                      <Engraving className={styles.checkArt} name={k.icon} label="" ratio="1 / 1" />
                      <h3>{k.name}</h3>
                      <p>{k.text}</p>
                    </li>
                  ))}
                </ul>
                <p className={styles.body}>
                  <span className="py-confirm">[CONFIRM LIST]</span>
                </p>
              </StoryChapter>
            );
          if (c.id === 'the-letter')
            return <StoryChapter key={c.id} chapter={c} num={num} wide={<Letter />} textFirst />;
          if (c.id === 'come-and-see')
            return (
              <StoryChapter
                key={c.id}
                chapter={c}
                num={num}
                wide={
                  <div className={styles.art} style={{ width: 'min(100%, 46rem)' }}>
                    <Engraving name={c.art!.name} label={c.art!.label} ratio={c.art!.ratio} />
                  </div>
                }
              >
                <a
                  className={styles.cta}
                  href={site.whatsapp.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Write to us <span aria-hidden="true">→</span>
                  <span className="sr-only"> on WhatsApp (opens in a new tab)</span>
                </a>
              </StoryChapter>
            );
          return <StoryChapter key={c.id} chapter={c} num={num} />;
        })}
      </ol>
      <ShopStrip />
    </main>
  );
}
