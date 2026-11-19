'use client';

import { scrollToHash } from '@/lib/motion/lenis';

/** "Back to the lake ↑": to the top, smoothly (Lenis when it runs). */
export function BackToTop({ className }: { className?: string }) {
  return (
    <a
      className={className}
      href="#top"
      onClick={(e) => {
        e.preventDefault();
        scrollToHash('#top');
      }}
    >
      Back to the lake <span aria-hidden="true">↑</span>
    </a>
  );
}
