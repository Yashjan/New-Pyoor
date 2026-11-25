'use client';

import { site } from '@/lib/site';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Button, ButtonLink } from '@/components/Button/Button';
import { useModalDialog } from '@/components/Dialog/useModalDialog';
import { CloseIcon, MinusIcon, PlusIcon } from '@/components/icons/Icons';
import { useCart } from '@/components/providers/CartProvider';
import {
  MAX_LINE_QUANTITY,
  getProduct,
  isPurchasable,
  type CartLine,
  type ProductVariant,
} from '@/lib/commerce';
import { formatPrice } from '@/lib/format';
import styles from './CartDrawer.module.css';

/** Line thumbnails: the products section's studio stills (the pouch's for a pouch line). */
const THUMBS: Record<string, string> = {
  'herbal-black-salt': '/images/renders/black-studio.webp',
  'natural-lake-salt': '/images/renders/lake-studio.webp',
  'the-sambhar-pair': '/images/renders/pair-studio.webp',
  'pink-rock-salt': '/images/renders/pink-studio.webp',
};
const POUCH_THUMBS: Record<string, string> = {
  'herbal-black-salt': '/images/renders/black-pouch-studio.webp',
  'natural-lake-salt': '/images/renders/lake-pouch-studio.webp',
  'pink-rock-salt': '/images/renders/pink-pouch-studio.webp',
};
/** A salt's refill pouch variant id from its jar's (local-data.ts). */
const isPouch = (variantId: string) => variantId.endsWith('-pouch-1kg');
const pouchOf = (jarVariantId: string) => jarVariantId.replace(/-1kg$/, '-pouch-1kg');
const thumbOf = (line: CartLine) => {
  const h = line.merchandise.product.handle;
  return (isPouch(line.merchandise.variantId) && POUCH_THUMBS[h]) || THUMBS[h];
};

/**
 * After a jar: one quiet line offering the same salt's refill pouch (the latest jar in the
 * bag whose salt has no pouch in it yet).
 */
function RefillSuggestion({ lines }: { lines: CartLine[] }) {
  const { add } = useCart();
  const jar = [...lines]
    .reverse()
    .find(
      (l) =>
        POUCH_THUMBS[l.merchandise.product.handle] &&
        !isPouch(l.merchandise.variantId) &&
        !lines.some((o) => o.merchandise.variantId === pouchOf(l.merchandise.variantId)),
    );
  const handle = jar?.merchandise.product.handle;
  const [pouch, setPouch] = useState<ProductVariant | null>(null);
  useEffect(() => {
    let live = true;
    if (!handle || !jar) return;
    const id = pouchOf(jar.merchandise.variantId);
    void getProduct(handle).then((p) => {
      if (live) setPouch(p?.variants.find((v) => v.id === id) ?? null);
    });
    return () => {
      live = false;
    };
  }, [handle, jar]);
  if (!jar || !pouch || pouch.id !== pouchOf(jar.merchandise.variantId)) return null;
  const can = isPurchasable(pouch);
  const title = jar.merchandise.product.title;
  return (
    <p className={styles.suggest}>
      <span>
        Refill pouch, 1 kg · {formatPrice(pouch.price)}
        <span className="sr-only">: {title}</span>
      </span>
      <button
        type="button"
        className={styles.suggestAdd}
        disabled={!can}
        onClick={() => void add(pouch.id, 1, `${title}, 1 kg pouch`)}
      >
        Add<span className="sr-only"> a refill pouch of {title}</span>
      </button>
    </p>
  );
}

export function CartDrawer() {
  const { cart, isOpen, closeCart } = useCart();
  const ref = useModalDialog(isOpen, closeCart, { exitMs: 350 });
  const lines = cart?.lines ?? [];

  return (
    <dialog ref={ref} className={styles.drawer} aria-labelledby="cart-title" data-lenis-prevent>
      <div className={styles.panel}>
        <div className={styles.head}>
          <h2 id="cart-title" className={styles.title}>
            Your bag
          </h2>
          <button type="button" className={styles.iconButton} onClick={closeCart}>
            <CloseIcon />
            <span className="sr-only">Close bag</span>
          </button>
        </div>

        {lines.length === 0 ? (
          <div className={styles.empty}>
            <p>Your bag is empty.</p>
            <ButtonLink href="/#shop" variant="secondary" onClick={closeCart}>
              Shop the salts
            </ButtonLink>
          </div>
        ) : (
          <div className={styles.linesBox}>
            <ul className={styles.lines}>
              {lines.map((line) => (
                <CartLineItem key={line.id} line={line} onNavigate={closeCart} />
              ))}
            </ul>
            <RefillSuggestion lines={lines} />
          </div>
        )}

        <div className={styles.foot}>
          <p className={styles.subtotal}>
            <span>Subtotal</span>
            <span>{formatPrice(cart?.subtotal ?? { amount: 0, currencyCode: 'INR' })}</span>
          </p>
          {lines.length > 0 && <FreeShipping amount={cart?.subtotal.amount ?? 0} />}
          <p className={styles.note}>Cash on delivery and online payment at checkout</p>
          <p className={styles.note}>
            Questions?{' '}
            <a href={site.whatsapp.url} target="_blank" rel="noopener noreferrer">
              WhatsApp us
            </a>
          </p>
          {/* until Shopify is connected (step 6) */}
          <Button variant="primary" fullWidth disabled>
            Checkout · Opening soon
          </Button>
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
        {thumbOf(line) ? (
          <Image
            src={thumbOf(line)!}
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
            Remove<span className="sr-only"> {product.title}</span>
          </button>
        </div>
      </div>
      <p className={styles.lineTotal}>{formatPrice(line.lineTotal)}</p>
    </li>
  );
}

/** "Free shipping from ₹499", with a thin line filling towards it (site.shipping). */
function FreeShipping({ amount }: { amount: number }) {
  const { freeFrom } = site.shipping;
  const left = freeFrom - amount;
  const p = Math.min(1, Math.max(0, amount / freeFrom));
  return (
    <div className={styles.ship}>
      <p className={styles.note}>
        {left > 0
          ? `Free shipping from ₹${freeFrom}: ₹${left} to go`
          : 'Free shipping on this order'}
      </p>
      <span className={styles.shipLine} aria-hidden="true">
        <span style={{ transform: `scaleX(${p})` }} />
      </span>
    </div>
  );
}
