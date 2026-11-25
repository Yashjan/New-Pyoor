'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './Story.module.css';

export interface Mark {
  id: string;
  /** "03", or null for an unnumbered aside */
  num: string | null;
  title: string;
}

/**
 * The story pages' place-keeper: a thin line down the left edge with a mark per chapter
 * (desktop; the marks are links), and on phones a small sticky bar, "03 / 08". It also lets
 * each chapter's text fade up the first time it enters view (motion only).
 */
export function StoryProgress({ marks }: { marks: Mark[] }) {
  const [current, setCurrent] = useState(0);
  const [p, setP] = useState(0);
  const [shown, setShown] = useState(false);
  const raf = useRef(0);

  useEffect(() => {
    const els = marks
      .map((m) => document.getElementById(m.id))
      .filter((e): e is HTMLElement => !!e);
    if (!els.length) return;
    const first = els[0]!;
    const update = () => {
      raf.current = 0;
      const mid = window.innerHeight * 0.45;
      let i = 0;
      els.forEach((e, k) => {
        if (e.getBoundingClientRect().top <= mid) i = k;
      });
      setCurrent(i);
      const top = first.getBoundingClientRect().top + window.scrollY;
      const last = els[els.length - 1]!;
      const end = last.getBoundingClientRect().bottom + window.scrollY - window.innerHeight;
      setP(Math.min(1, Math.max(0, (window.scrollY + mid - top) / Math.max(1, end + mid - top))));
      setShown(first.getBoundingClientRect().top < mid);
    };
    const onScroll = () => {
      if (!raf.current) raf.current = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    // the text fades up once (motion only: CSS keeps it visible otherwise)
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries)
          if (e.isIntersecting) {
            e.target.setAttribute('data-in', '');
            io.unobserve(e.target);
          }
      },
      { rootMargin: '0px 0px -12% 0px' },
    );
    document.querySelectorAll('[data-fade]').forEach((e) => io.observe(e));
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      cancelAnimationFrame(raf.current);
      io.disconnect();
    };
  }, [marks]);

  const numbered = marks.filter((m) => m.num);
  const m = marks[current]!;
  return (
    <>
      <nav className={styles.rail} aria-label="Chapters" data-shown={shown || undefined}>
        <span className={styles.railLine} aria-hidden="true">
          <span style={{ transform: `scaleY(${p.toFixed(4)})` }} />
        </span>
        <ol>
          {marks.map((k, i) => (
            <li key={k.id} style={{ top: `${(i / Math.max(1, marks.length - 1)) * 100}%` }}>
              <a
                href={`#${k.id}`}
                aria-current={i === current ? 'step' : undefined}
                data-past={i <= current || undefined}
              >
                <span className={styles.railNum}>{k.num ?? '·'}</span>
                <span className={styles.railTitle}>{k.title}</span>
              </a>
            </li>
          ))}
        </ol>
      </nav>
      <div className={styles.bar} aria-hidden="true" data-shown={shown || undefined}>
        {m.num ? (
          <>
            <span className={styles.barNum}>
              {m.num} / {String(numbered.length).padStart(2, '0')}
            </span>
            <span className={styles.barTitle}>{m.title}</span>
          </>
        ) : (
          <span className={styles.barTitle}>{m.title}</span>
        )}
      </div>
    </>
  );
}
