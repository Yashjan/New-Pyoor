'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useCart } from '@/components/providers/CartProvider';
import { flyToBag } from '@/components/sections/Products/flyToBag';
import styles from './JarHero.module.css';

export interface InviteProps {
  title: string;
  size: string;
  /** formatted, or null while the price is not set */
  price: string | null;
  variantId: string;
}

/**
 * Shot 4b, the invitation: once the mound has settled, a small panel beside it (phones: below
 * it) with the jar's price and "Add to bag" (or "Price coming soon" and a link to the
 * products). HomeMotion fades it in and out with the film and places it by the mound.
 */
export function Invite({ title, size, price, variantId }: InviteProps) {
  const { add } = useCart();
  const [pending, setPending] = useState(false);
  return (
    <div className={styles.invite} data-invite>
      <p className={styles.inviteLine}>
        {title} · {size}
        {price && (
          <>
            {' '}
            · <span className={styles.invitePrice}>{price}</span>
          </>
        )}
      </p>
      {price ? (
        <button
          type="button"
          className={styles.inviteAdd}
          aria-busy={pending}
          onClick={async (e) => {
            if (pending) return;
            setPending(true);
            // the jar flies from the panel: the closest image of it is the hero's poster
            flyToBag(
              document.querySelector<HTMLImageElement>('[data-hero] img[src*="jar-black"]') ??
                (e.currentTarget.ownerDocument.querySelector(
                  '[data-products] img',
                ) as HTMLImageElement | null),
            );
            try {
              await add(variantId, 1, `${title}, ${size}`);
            } finally {
              setPending(false);
            }
          }}
        >
          Add to bag
          <span className="sr-only">
            : {title}, {size}
          </span>
        </button>
      ) : (
        <>
          <p className={styles.inviteSoon}>Price coming soon</p>
          <Link className={styles.inviteLink} href="/shop">
            See products
          </Link>
        </>
      )}
    </div>
  );
}
