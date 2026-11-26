'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { ButtonLink } from '@/components/Button/Button';
import { useCart } from '@/components/providers/CartProvider';
import { rupees, type OrderView } from '@/lib/checkout';
import { site } from '@/lib/site';
import styles from './Checkout.module.css';

const FORMAT = { jar: '1 kg jar', pouch: '1 kg refill pouch' } as const;

/** The order confirmation (/order?ref=…&token=…): the order, from the API, with its token. */
export function Confirmation() {
  const params = useSearchParams();
  const ref = params.get('ref') ?? '';
  const token = params.get('token') ?? '';
  const { clear } = useCart();
  const [order, setOrder] = useState<OrderView | null>(null);
  const [state, setState] = useState<'loading' | 'ok' | 'missing' | 'offline'>('loading');
  const cleared = useRef(false);

  useEffect(() => {
    let live = true;
    let tries = 0;
    let timer = 0;
    const load = async () => {
      const res = await fetch(
        `/api/orders/${encodeURIComponent(ref)}?token=${encodeURIComponent(token)}`,
      ).catch(() => null);
      if (!live) return;
      if (!res) return setState('offline');
      if (!res.ok) return setState('missing');
      const o = (await res.json()) as OrderView;
      setOrder(o);
      setState('ok');
      if (!cleared.current) {
        cleared.current = true;
        void clear();
      }
      // an online payment still being confirmed (the webhook): look again for a minute
      if (o.status === 'pending' && ++tries < 12) timer = window.setTimeout(load, 5000);
    };
    void load();
    return () => {
      live = false;
      window.clearTimeout(timer);
    };
  }, [ref, token, clear]);

  if (state === 'loading') return <p className={styles.ref}>Loading your order…</p>;
  if (state !== 'ok' || !order)
    return (
      <div className={styles.empty}>
        <p>
          {state === 'offline'
            ? 'We couldn’t reach our server. Please check your connection and reload.'
            : 'We couldn’t find this order. Please use the link from your confirmation, or write to us.'}
        </p>
        <ButtonLink href={site.whatsapp.url} variant="secondary">
          WhatsApp us
        </ButtonLink>
      </div>
    );

  const pending = order.status === 'pending';
  return (
    <div>
      <p className={styles.ref}>
        Order <strong data-ref>{order.ref}</strong>
        {pending ? ' · confirming your payment…' : ''}
      </p>
      <div className={styles.block}>
        <h2>Your order</h2>
        <ul className={styles.items}>
          {order.items.map((i) => (
            <li key={i.id}>
              <span>
                {i.name}, {FORMAT[i.format]} × {i.qty}
              </span>
              <span>{rupees(i.unitPaise * i.qty)}</span>
            </li>
          ))}
          <li>
            <span>Shipping</span>
            <span>{order.shippingPaise === 0 ? 'Free' : rupees(order.shippingPaise)}</span>
          </li>
          <li>
            <strong>Total</strong>
            <strong data-total>{rupees(order.totalPaise)}</strong>
          </li>
        </ul>
      </div>
      <div className={styles.block}>
        <h2>Payment</h2>
        <p data-payment>
          {order.payment === 'cod'
            ? `Cash on delivery: please keep ${rupees(order.totalPaise)} ready.`
            : pending
              ? 'Paid online: we’re confirming your payment with the bank.'
              : 'Paid online.'}
        </p>
      </div>
      <div className={styles.block}>
        <h2>Delivering to</h2>
        <p>
          {order.name}
          {order.address.map((l) => (
            <span key={l}>
              <br />
              {l}
            </span>
          ))}
        </p>
      </div>
      <div className={styles.block}>
        <p>We’ll send your tracking details on WhatsApp once it ships.</p>
        <p className={styles.hint}>
          Questions?{' '}
          <a href={site.whatsapp.url} target="_blank" rel="noopener noreferrer">
            WhatsApp {site.whatsapp.label}
          </a>
        </p>
      </div>
    </div>
  );
}
