'use client';

import { useState } from 'react';
import { Button } from '@/components/Button/Button';
import { useCart } from '@/components/providers/CartProvider';

/** Primary "Add to bag". Announces via the toast; focus stays on the button. */
export function AddToBagButton({
  variantId,
  productTitle,
}: {
  variantId: string;
  productTitle: string;
}) {
  const { add } = useCart();
  const [pending, setPending] = useState(false);

  async function handleClick() {
    if (pending) return;
    setPending(true);
    try {
      await add(variantId, 1, productTitle);
    } finally {
      setPending(false);
    }
  }

  return (
    <Button variant="primary" aria-busy={pending} onClick={handleClick}>
      Add to bag<span className="sr-only">: {productTitle}</span>
    </Button>
  );
}
