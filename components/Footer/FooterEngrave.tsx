'use client';

import { useEffect, useRef } from 'react';

/** Engraves the footer's SAMBHAR once, when it comes into view (motion only; CSS does the rest). */
export function FooterEngrave() {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const word = ref.current?.parentElement;
    if (!word || !document.documentElement.classList.contains('motion')) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e?.isIntersecting) return;
        io.disconnect();
        word.setAttribute('data-on', '');
      },
      { threshold: 0.4 },
    );
    io.observe(word);
    return () => io.disconnect();
  }, []);
  return <span ref={ref} hidden />;
}
