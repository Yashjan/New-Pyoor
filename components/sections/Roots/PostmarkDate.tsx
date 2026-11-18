'use client';

import { useSyncExternalStore } from 'react';

/** Today in India, as a postmark has it: "18 NOV 2026". */
const today = () => {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('day')} ${get('month').toUpperCase().slice(0, 3)} ${get('year')}`;
};

const noop = () => () => {};

/**
 * The postmark's date: the visitor's today (IST), set after mount (the server renders none, so
 * nothing mismatches), fading in.
 */
export function PostmarkDate() {
  // '' on the server and in the first (hydrating) render; today once mounted
  const date = useSyncExternalStore(noop, today, () => '');
  return (
    <text
      x="50"
      y="53"
      fontSize="7.4"
      fill="#c7a25a"
      textAnchor="middle"
      fontFamily="sans-serif"
      style={{ opacity: date ? 0.95 : 0, transition: 'opacity 0.6s ease' }}
    >
      {date}
    </text>
  );
}
