import type { Metadata } from 'next';
import Link from 'next/link';
import { asset } from '@/lib/basePath';
import {
  ShopStrip,
  StoryChapter,
  StoryIntro,
  StoryNav,
  storyStyles as styles,
} from '@/components/story/Story';
import { JOURNEY, JOURNEY_INTRO, KALA_NAMAK } from '@/lib/content/story';

export const metadata: Metadata = {
  title: 'The journey',
  description:
    'How salt is made at Sambhar Lake, from brine in the pans to the harvest and the heaps, and how it is checked, packed and reaches your kitchen. And how black salt is made.',
  alternates: { canonical: '/the-journey' },
  openGraph: { title: 'The journey · Pyoor', description: 'From the lake to your kitchen.' },
};

/** /the-journey: "From the lake to your kitchen." Nine chapters; a side note on kala namak. */
export default function JourneyPage() {
  const marks = [
    ...JOURNEY.map((c, i) => ({ id: c.id, num: String(i + 1).padStart(2, '0'), title: c.title })),
    { id: 'kala-namak', num: null, title: 'Kala namak' },
  ];
  return (
    <main id="main" className={styles.main}>
      <StoryNav marks={marks} />
      <StoryIntro {...JOURNEY_INTRO} />
      <ol className={styles.chapters}>
        {JOURNEY.map((c, i) => (
          <StoryChapter key={c.id} chapter={c} num={i + 1}>
            {c.id === 'kitchen' && (
              <Link className={styles.cta} href="/recipes/nimbu-pani">
                Try it in nimbu pani <span aria-hidden="true">→</span>
              </Link>
            )}
            {c.id === 'checked' && (
              <Link className={styles.cta} href="/our-roots#what-we-check">
                What we check <span aria-hidden="true">→</span>
              </Link>
            )}
          </StoryChapter>
        ))}
      </ol>

      <section id="kala-namak" className={styles.aside} aria-labelledby="kala-namak-title">
        <header className={styles.asideHead} data-fade>
          <p className="py-eyebrow">A side note · Kala namak</p>
          <h2 id="kala-namak-title" className="py-display py-d-m">
            {KALA_NAMAK.title}
          </h2>
        </header>
        <ol className={styles.frames}>
          {KALA_NAMAK.steps.map((s, i) => (
            <li key={i}>
              <figure>
                {/* eslint-disable-next-line @next/next/no-img-element -- a still SVG drawing */}
                <img
                  className={styles.fireImg}
                  src={asset(`/engravings/fire-${i + 1}.svg`)}
                  alt={s.alt}
                  width={640}
                  height={360}
                  loading="lazy"
                  decoding="async"
                />
                <figcaption data-fade>
                  <span className={styles.step} aria-hidden="true">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  {s.text}
                </figcaption>
              </figure>
            </li>
          ))}
        </ol>
      </section>
      <ShopStrip />
    </main>
  );
}
