'use client';

import { useId, useState, type FormEvent } from 'react';
import { Button } from '@/components/Button/Button';
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
      <label htmlFor={id}>Recipes and new batches, once a month</label>
      <input id={id} name="email" type="email" placeholder="you@example.com" autoComplete="email" />
      <Button variant="primary" type="submit">
        Join
      </Button>
      <p className={styles.msg} role="status">
        {msg}
      </p>
    </form>
  );
}
