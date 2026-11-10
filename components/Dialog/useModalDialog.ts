'use client';

import { useEffect, useRef } from 'react';

/**
 * Drives a native <dialog> from React state. Native modal dialogs give us focus trapping,
 * Esc to close, inertness of the page behind and focus return for free.
 *
 * - `open` true → showModal(); false → close().
 * - Esc or `dialog.close()` from inside fires `onClose` so state stays in sync.
 * - A click on the backdrop (the dialog element itself) closes it.
 */
export function useModalDialog(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const handleClose = () => onClose();
    const handleClick = (e: MouseEvent) => {
      if (e.target === dialog) dialog.close();
    };
    dialog.addEventListener('close', handleClose);
    dialog.addEventListener('click', handleClick);
    return () => {
      dialog.removeEventListener('close', handleClose);
      dialog.removeEventListener('click', handleClick);
    };
  }, [onClose]);

  return ref;
}
