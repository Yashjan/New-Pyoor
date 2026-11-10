'use client';

import { useId, useState, type FormEvent } from 'react';
import styles from './Footer.module.css';

/**
 * Newsletter sign-up. No backend yet: submitting only validates and shows a thank-you.
 * Wire this to the email provider (or Shopify customer marketing consent) later.
 */
export function NewsletterForm() {
  const [done, setDone] = useState(false);
  const inputId = useId();

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (e.currentTarget.checkValidity()) setDone(true);
  }

  return (
    <form className={styles.newsletter} onSubmit={handleSubmit}>
      <label htmlFor={inputId} className={styles.newsletterLabel}>
        News of launches and recipes, now and then
      </label>
      <div className={styles.newsletterRow}>
        <input
          id={inputId}
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
          className={styles.newsletterInput}
          disabled={done}
        />
        <button type="submit" className={styles.newsletterButton} disabled={done}>
          Subscribe
        </button>
      </div>
      <p className={styles.newsletterStatus} role="status">
        {done ? 'Thanks — you’re on the list' : ''}
      </p>
    </form>
  );
}
