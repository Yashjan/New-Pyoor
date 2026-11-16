'use client';

import { useEffect, useRef } from 'react';
import { lenisStore } from '@/lib/motion/lenis';

interface Options {
  /** ms the closing animation takes (data-state="closing"), before the dialog really closes. */
  exitMs?: number;
}

/**
 * Drives a native <dialog> from React state. Native modal dialogs give us focus trapping,
 * Esc to close, inertness of the page behind and focus return for free.
 *
 * - `open` true → showModal(); false → data-state="closing", then close() after `exitMs`.
 * - Esc, a click on the backdrop (the dialog element itself) or close() from inside fire
 *   `onClose`, so state stays in sync.
 * - While open, the page holds still the way the menu does it (components/SiteMenu): Lenis
 *   stopped and <html> overflow hidden, nothing else (no ScrollTrigger refresh), and the scroll
 *   position restored exactly on close.
 */
export function useModalDialog(open: boolean, onClose: () => void, { exitMs = 0 }: Options = {}) {
  const ref = useRef<HTMLDialogElement>(null);
  const saved = useRef<number | null>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const html = document.documentElement;
    const lock = () => {
      if (saved.current !== null) return;
      saved.current = window.scrollY;
      lenisStore.get()?.stop();
      html.style.overflow = 'hidden';
    };
    const unlock = () => {
      if (saved.current === null) return;
      const y = saved.current;
      saved.current = null;
      html.style.overflow = '';
      if (Math.abs(window.scrollY - y) > 0.5) window.scrollTo(0, y);
      lenisStore.get()?.start();
    };
    if (open && !dialog.open) {
      lock();
      dialog.dataset.state = 'open';
      dialog.showModal();
    } else if (open) dialog.dataset.state = 'open'; // reopened while closing
    if (!open && dialog.open) {
      dialog.dataset.state = 'closing';
      const t = window.setTimeout(() => {
        dialog.close();
        delete dialog.dataset.state;
        unlock();
      }, exitMs);
      return () => window.clearTimeout(t);
    }
    if (!open) unlock();
  }, [open, exitMs]);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const handleClose = () => onClose();
    // Esc: close through state, so the exit animation plays
    const handleCancel = (e: Event) => {
      e.preventDefault();
      onClose();
    };
    const handleClick = (e: MouseEvent) => {
      if (e.target === dialog) onClose();
    };
    dialog.addEventListener('close', handleClose);
    dialog.addEventListener('cancel', handleCancel);
    dialog.addEventListener('click', handleClick);
    return () => {
      dialog.removeEventListener('close', handleClose);
      dialog.removeEventListener('cancel', handleCancel);
      dialog.removeEventListener('click', handleClick);
    };
  }, [onClose]);

  // never leave the page locked
  useEffect(
    () => () => {
      if (saved.current === null) return;
      document.documentElement.style.overflow = '';
      lenisStore.get()?.start();
    },
    [],
  );

  return ref;
}
