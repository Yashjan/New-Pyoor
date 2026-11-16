'use client';

import { useEffect, useRef } from 'react';

/**
 * The section's entrance: once it comes into view, its [data-rise] elements fade up 16px
 * with a short stagger (CSS; once). Nothing is hidden without JS or under reduced motion.
 */
export function Entrance() {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const section = ref.current?.closest<HTMLElement>('[data-products]');
    if (!section || !document.documentElement.classList.contains('motion')) return;
    section.dataset.rise = 'wait';
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e?.isIntersecting) return;
        section.dataset.rise = 'in';
        io.disconnect();
      },
      { rootMargin: '0px 0px -15% 0px' },
    );
    io.observe(section);
    return () => io.disconnect();
  }, []);
  return <span ref={ref} hidden />;
}
