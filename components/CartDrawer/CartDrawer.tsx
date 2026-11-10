'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Button, ButtonLink } from '@/components/Button/Button';
import { useModalDialog } from '@/components/Dialog/useModalDialog';
import { CloseIcon, MinusIcon, PlusIcon } from '@/components/icons/Icons';
import { useCart } from '@/components/providers/CartProvider';
import { MAX_LINE_QUANTITY, type CartLine } from '@/lib/commerce';
import { formatPrice } from '@/lib/format';
import styles from './CartDrawer.module.css';

export function CartDrawer() {
  const { cart, isOpen, closeCart } = useCart();
  const ref = useModalDialog(isOpen, closeCart);
  const lines = cart?.lines ?? [];

  return (
    <dialog ref={ref} className={styles.drawer} aria-labelledby="cart-title">
      <div className={styles.panel}>
        <div className={styles.head}>
          <h2 id="cart-title" className={styles.title}>
            Your cart
          </h2>
          <button type="button" className={styles.iconButton} onClick={closeCart}>
            <CloseIcon />
            <span className="visually-hidden">Close cart</span>
          </button>
        </div>

        {lines.length === 0 ? (
          <div className={styles.empty}>
            <p>Your cart is empty.</p>
            <ButtonLink href="/#shop" variant="outline" onClick={closeCart}>
              Shop the salts
            </ButtonLink>
          </div>
        ) : (
          <ul className={styles.lines}>
            {lines.map((line) => (
              <CartLineItem key={line.id} line={line} onNavigate={closeCart} />
            ))}
          </ul>
        )}

        <div className={styles.foot}>
          <p className={styles.subtotal}>
            <span>Subtotal</span>
            <span>{formatPrice(cart?.subtotal ?? null)}</span>
          </p>
          <p className={styles.note}>
            Delivery is calculated at checkout. Cash on delivery available.
          </p>
          <Button variant="primary" fullWidth disabled aria-describedby="checkout-note">
            Checkout
          </Button>
          <p id="checkout-note" className={styles.note}>
            Checkout opens soon
          </p>
        </div>
      </div>
    </dialog>
  );
}

function CartLineItem({ line, onNavigate }: { line: CartLine; onNavigate: () => void }) {
  const { update, remove } = useCart();
  const { product, variantTitle } = line.merchandise;
  const href = `/product/${product.handle}`;

  return (
    <li className={styles.line}>
      <div className={styles.thumb}>
        {product.featuredImage ? (
          <Image
            src={product.featuredImage.url}
            alt=""
            width={72}
            height={90}
            sizes="72px"
            className={styles.thumbImg}
          />
        ) : (
          <span aria-hidden="true" className={styles.thumbBlank} />
        )}
      </div>
      <div className={styles.lineBody}>
        <Link href={href} className={styles.lineTitle} onClick={onNavigate}>
          {product.title}
        </Link>
        <p className={styles.lineMeta}>
          {variantTitle} · {formatPrice(line.unitPrice)}
        </p>
        <div className={styles.lineActions}>
          <div className={styles.stepper} role="group" aria-label={`Quantity, ${product.title}`}>
            <button
              type="button"
              onClick={() => update(line.id, line.quantity - 1)}
              aria-label="Decrease quantity"
            >
              <MinusIcon size={18} />
            </button>
            <output aria-live="polite">{line.quantity}</output>
            <button
              type="button"
              onClick={() => update(line.id, line.quantity + 1)}
              disabled={line.quantity >= MAX_LINE_QUANTITY}
              aria-label="Increase quantity"
            >
              <PlusIcon size={18} />
            </button>
          </div>
          <button type="button" className={styles.remove} onClick={() => remove(line.id)}>
            Remove<span className="visually-hidden"> {product.title}</span>
          </button>
        </div>
      </div>
      <p className={styles.lineTotal}>{formatPrice(line.lineTotal)}</p>
    </li>
  );
}
