'use client';

import { useEffect, useState } from 'react';
import styles from './Recipe.module.css';

/** The ingredients, each with a checkbox; what's ticked is kept (per recipe) in localStorage. */
export function Ingredients({ slug, items }: { slug: string; items: string[] }) {
  const key = `pyoor:recipe:${slug}`;
  const [done, setDone] = useState<boolean[]>(() => items.map(() => false));
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(key) ?? '[]') as unknown;
      if (Array.isArray(saved) && saved.some(Boolean))
        // eslint-disable-next-line react-hooks/set-state-in-effect -- read once after hydration
        setDone(items.map((_, i) => saved[i] === true));
    } catch {}
  }, [key, items]);
  const toggle = (i: number) =>
    setDone((d) => {
      const next = d.map((v, j) => (j === i ? !v : v));
      try {
        localStorage.setItem(key, JSON.stringify(next));
      } catch {}
      return next;
    });
  return (
    <ul className={styles.ingredients}>
      {items.map((item, i) => (
        <li key={item}>
          <label className={styles.check}>
            <input type="checkbox" checked={done[i] ?? false} onChange={() => toggle(i)} />
            <span>{item}</span>
          </label>
        </li>
      ))}
    </ul>
  );
}
