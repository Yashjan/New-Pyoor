'use client';

import { useState } from 'react';
import { Button, type ButtonVariant } from '@/components/Button/Button';
import { useCart } from '@/components/providers/CartProvider';

interface AddToCartButtonProps {
  variantId: string;
  /** False for unpriced/unavailable variants: the button is disabled. */
  purchasable: boolean;
  productTitle: string;
  variant?: ButtonVariant;
  quantity?: number;
  className?: string;
}

export function AddToCartButton({
  variantId,
  purchasable,
  productTitle,
  variant = 'dark',
  quantity = 1,
  className,
}: AddToCartButtonProps) {
  const { add } = useCart();
  const [pending, setPending] = useState(false);

  async function handleClick() {
    if (pending) return;
    setPending(true);
    try {
      await add(variantId, quantity);
    } finally {
      setPending(false);
    }
  }

  return (
    <Button
      variant={variant}
      fullWidth
      className={className}
      // Not `disabled` while pending: a disabled button drops focus, and the cart dialog
      // returns focus to whatever had it when it opened.
      disabled={!purchasable}
      aria-disabled={pending || undefined}
      aria-busy={pending}
      onClick={handleClick}
    >
      {pending ? 'Adding…' : 'Add to cart'}
      <span className="visually-hidden">: {productTitle}</span>
    </Button>
  );
}
