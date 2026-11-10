import type { ReactNode } from 'react';
import styles from './SectionHeading.module.css';

interface SectionHeadingProps {
  id: string;
  title: string;
  eyebrow?: string;
  intro?: ReactNode;
  tone?: 'dark' | 'light';
  align?: 'start' | 'center';
}

/** Eyebrow label + uppercase H2 + optional intro. `id` labels the parent section. */
export function SectionHeading({
  id,
  title,
  eyebrow,
  intro,
  tone = 'dark',
  align = 'start',
}: SectionHeadingProps) {
  return (
    <header
      className={[styles.heading, styles[tone], align === 'center' && styles.center]
        .filter(Boolean)
        .join(' ')}
      data-reveal
    >
      {eyebrow && <p className={styles.eyebrow}>{eyebrow}</p>}
      <h2 id={id} className={styles.title}>
        {title}
      </h2>
      {intro && <p className={styles.intro}>{intro}</p>}
    </header>
  );
}
