'use client';

import { useId, useState, type FormEvent } from 'react';
import styles from './Footer.module.css';

/** Newsletter sign-up. No backend yet: it validates and thanks, with no network call. */
export function NewsletterForm() {
  const [msg, setMsg] = useState('');
  const id = useId();

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const value = String(new FormData(e.currentTarget).get('email') ?? '').trim();
    setMsg(
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
        ? 'Thanks, you’re on the list.'
        : 'Enter a valid email address.',
    );
  }

  return (
    <form className={styles.news} onSubmit={handleSubmit} noValidate>
      <p className={styles.newsLine}>Recipes and new batches, once a month.</p>
      <label htmlFor={id} className="sr-only">
        Email address
      </label>
      <div className={styles.field}>
        <input
          id={id}
          name="email"
          type="email"
          placeholder="you@example.com"
          autoComplete="email"
        />
        <button type="submit" className={styles.subscribe}>
          Subscribe <span aria-hidden="true">→</span>
        </button>
      </div>
      <p className={styles.msg} role="status">
        {msg}
      </p>
    </form>
  );
}
