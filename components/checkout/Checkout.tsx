'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, ButtonLink } from '@/components/Button/Button';
import { thumbOf } from '@/components/CartDrawer/thumbs';
import { MinusIcon, PlusIcon } from '@/components/icons/Icons';
import { useCart } from '@/components/providers/CartProvider';
import { MAX_LINE_QUANTITY, type CartLine } from '@/lib/commerce';
import { COD_LIMIT_INR, codAllowed, shippingPaise } from '@/lib/commerce/pricing';
import {
  apiProductId,
  fieldErrors,
  normalisePhone,
  rupees,
  type FieldErrors,
  type PaymentMethod,
} from '@/lib/checkout';
import { INDIAN_STATES } from '@/lib/india';
import { site } from '@/lib/site';
import { razorpayPay, turnstileToken } from './scripts';
import styles from './Checkout.module.css';

type Form = {
  name: string;
  phone: string;
  email: string;
  line1: string;
  line2: string;
  landmark: string;
  pincode: string;
  city: string;
  state: string;
};
const EMPTY: Form = {
  name: '',
  phone: '',
  email: '',
  line1: '',
  line2: '',
  landmark: '',
  pincode: '',
  city: '',
  state: '',
};

// the form while it's being filled (kept across a reload); the saved details (only if ticked)
const DRAFT = 'pyoor:checkout:draft:v1';
const SAVED = 'pyoor:checkout:saved:v1';
const ATTEMPT = 'pyoor:checkout:attempt:v1';

const store = {
  get(s: Storage | undefined, k: string) {
    try {
      const v = s?.getItem(k);
      return v ? (JSON.parse(v) as unknown) : null;
    } catch {
      return null;
    }
  },
  set(s: Storage | undefined, k: string, v: unknown) {
    try {
      if (v == null) s?.removeItem(k);
      else s?.setItem(k, JSON.stringify(v));
    } catch {
      // storage blocked: the page still works
    }
  },
};
const ls = () => (typeof window === 'undefined' ? undefined : window.localStorage);
const ss = () => (typeof window === 'undefined' ? undefined : window.sessionStorage);

const asForm = (v: unknown): Form | null => {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const f = { ...EMPTY };
  for (const k of Object.keys(EMPTY) as (keyof Form)[])
    if (typeof o[k] === 'string') f[k] = (o[k] as string).slice(0, 160);
  return f;
};

/** One idempotency key per distinct order: a double click or a retry reuses it. */
function attemptKey(fingerprint: string): string {
  const a = store.get(ss(), ATTEMPT) as { key?: string; fp?: string } | null;
  if (a?.key && a.fp === fingerprint) return a.key;
  const key = crypto.randomUUID();
  store.set(ss(), ATTEMPT, { key, fp: fingerprint });
  return key;
}

const paiseOf = (line: CartLine) => Math.round(line.lineTotal.amount * 100);

export function Checkout() {
  const router = useRouter();
  const { cart, update, remove } = useCart();
  const lines = useMemo(() => cart?.lines ?? [], [cart]);
  const [form, setForm] = useState<Form>(EMPTY);
  const [save, setSave] = useState(false);
  const [payment, setPayment] = useState<PaymentMethod>('online');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [showOrder, setShowOrder] = useState(false);
  const [ready, setReady] = useState(false);
  const turnstileEl = useRef<HTMLDivElement>(null);

  // restore: the draft first, else the saved details
  useEffect(() => {
    const saved = asForm(store.get(ls(), SAVED));
    const draft = asForm(store.get(ls(), DRAFT));
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read once from storage after hydration
    setForm(draft ?? saved ?? EMPTY);
    setSave(!!saved);
    setReady(true);
  }, []);
  useEffect(() => {
    if (ready) store.set(ls(), DRAFT, form);
  }, [form, ready]);

  const subtotal = lines.reduce((s, l) => s + paiseOf(l), 0);
  const shipping = shippingPaise(subtotal);
  const total = subtotal + shipping;
  const cod = codAllowed(total);
  const method: PaymentMethod = payment === 'cod' && !cod ? 'online' : payment;

  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const v = e.target.value;
    setForm((f) => ({ ...f, [k]: v }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const contact = { name: form.name.trim(), phone: form.phone, email: form.email.trim() };
  const address = {
    line1: form.line1.trim(),
    line2: form.line2.trim(),
    landmark: form.landmark.trim(),
    pincode: form.pincode.trim(),
    city: form.city.trim(),
    state: form.state,
  };

  const finish = (ref: string, token: string) => {
    store.set(ls(), SAVED, save ? form : null);
    store.set(ls(), DRAFT, null);
    store.set(ss(), ATTEMPT, null);
    router.push(`/order?ref=${encodeURIComponent(ref)}&token=${encodeURIComponent(token)}`);
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || lines.length === 0) return;
    setMessage('');
    const errs = fieldErrors(contact, address);
    setErrors(errs);
    if (Object.keys(errs).length) {
      const first = Object.keys(errs)[0];
      document.getElementById(`co-${first}`)?.focus();
      return;
    }
    setBusy(true);
    try {
      const items = lines.map((l) => ({
        id: apiProductId(l.merchandise.variantId),
        qty: l.quantity,
      }));
      const fingerprint = JSON.stringify({ items, contact, address, method });
      let token: string;
      try {
        token = await turnstileToken(turnstileEl.current!);
      } catch {
        setMessage('We couldn’t check the page. Please try again in a moment.');
        return;
      }
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idempotencyKey: attemptKey(fingerprint),
          items,
          contact,
          address,
          payment: method,
          expectedTotalPaise: total,
          turnstileToken: token,
        }),
      }).catch(() => null);
      const data = (await res?.json().catch(() => null)) as Record<string, unknown> | null;
      if (!res || !data) {
        setMessage('We couldn’t reach our server. Check your connection and try again.');
        return;
      }
      if (!res.ok) {
        if (data.fields) setErrors(data.fields as FieldErrors);
        setMessage(
          data.error === 'prices_changed'
            ? `Our prices have changed since you opened your bag: the total is now ${rupees(
                Number(data.totalPaise),
              )}. Please reload the page to see the new prices.`
            : data.error === 'unavailable'
              ? 'An item in your bag is no longer available. Please remove it and try again.'
              : data.error === 'invalid'
                ? ((data.fields as FieldErrors)?.form ??
                  (data.fields as FieldErrors)?.items ??
                  'Please check the highlighted fields.')
                : typeof data.error === 'string'
                  ? data.error
                  : 'Something went wrong. Please try again.',
        );
        return;
      }
      const ref = String(data.ref);
      const access = String(data.token);
      if (data.payment === 'cod' || data.status !== 'pending') return finish(ref, access);

      const paid = await razorpayPay({
        keyId: String(data.keyId),
        orderId: String(data.razorpayOrderId),
        amount: Number(data.amount),
        ref,
        prefill: {
          name: contact.name,
          contact: `+91${normalisePhone(contact.phone)}`,
          ...(contact.email ? { email: contact.email } : {}),
        },
      }).catch(() => 'failed' as const);
      if (paid === null) {
        setMessage(
          'Payment was not completed. Your order is saved: you can pay whenever you’re ready.',
        );
        return;
      }
      if (paid === 'failed') {
        setMessage('The payment didn’t go through. No money was taken; please try again.');
        return;
      }
      const v = await fetch('/api/payments/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ref, token: access, ...paid }),
      }).catch(() => null);
      // a verify that didn't arrive is settled by Razorpay's webhook: the order page shows it
      if (v && !v.ok && v.status === 400) {
        setMessage(
          'We couldn’t confirm the payment. If money was taken, it will be confirmed shortly. Please write to us on WhatsApp.',
        );
        return;
      }
      finish(ref, access);
    } finally {
      setBusy(false);
    }
  }

  if (cart && lines.length === 0)
    return (
      <div className={styles.empty}>
        <p>Your bag is empty.</p>
        <ButtonLink href="/#shop" variant="secondary">
          Shop the salts
        </ButtonLink>
      </div>
    );

  const field = (
    k: keyof Form,
    label: string,
    props: React.InputHTMLAttributes<HTMLInputElement> = {},
  ) => (
    <div className={styles.field} data-invalid={errors[k] ? '' : undefined}>
      <label htmlFor={`co-${k}`}>{label}</label>
      <input
        id={`co-${k}`}
        name={k}
        value={form[k]}
        onChange={set(k)}
        aria-invalid={!!errors[k]}
        aria-describedby={errors[k] ? `co-${k}-err` : undefined}
        {...props}
      />
      {errors[k] && (
        <p id={`co-${k}-err`} className={styles.error}>
          {errors[k]}
        </p>
      )}
    </div>
  );

  return (
    <div className={styles.layout}>
      <form className={styles.form} onSubmit={submit} noValidate aria-label="Checkout">
        <fieldset className={styles.section}>
          <legend>
            <span className={styles.num}>1</span> Contact
          </legend>
          {field('name', 'Full name', { autoComplete: 'name', maxLength: 80, required: true })}
          <div className={styles.field} data-invalid={errors.phone ? '' : undefined}>
            <label htmlFor="co-phone">Mobile number</label>
            <div className={styles.phone}>
              <span aria-hidden="true">+91</span>
              <input
                id="co-phone"
                name="phone"
                type="tel"
                inputMode="numeric"
                autoComplete="tel-national"
                maxLength={14}
                value={form.phone}
                onChange={set('phone')}
                aria-invalid={!!errors.phone}
                aria-describedby={errors.phone ? 'co-phone-err' : 'co-phone-hint'}
                required
              />
            </div>
            {errors.phone ? (
              <p id="co-phone-err" className={styles.error}>
                {errors.phone}
              </p>
            ) : (
              <p id="co-phone-hint" className={styles.hint}>
                For delivery updates on WhatsApp.
              </p>
            )}
          </div>
          {field('email', 'Email (optional)', {
            type: 'email',
            autoComplete: 'email',
            maxLength: 120,
          })}
        </fieldset>

        <fieldset className={styles.section}>
          <legend>
            <span className={styles.num}>2</span> Delivery address
          </legend>
          {field('line1', 'House / flat', {
            autoComplete: 'address-line1',
            maxLength: 120,
            required: true,
          })}
          {field('line2', 'Street / area', {
            autoComplete: 'address-line2',
            maxLength: 120,
            required: true,
          })}
          {field('landmark', 'Landmark (optional)', { maxLength: 120 })}
          <div className={styles.row}>
            {field('pincode', 'Pincode', {
              inputMode: 'numeric',
              autoComplete: 'postal-code',
              maxLength: 6,
              required: true,
            })}
            {field('city', 'City', {
              autoComplete: 'address-level2',
              maxLength: 60,
              required: true,
            })}
          </div>
          <div className={styles.field} data-invalid={errors.state ? '' : undefined}>
            <label htmlFor="co-state">State</label>
            <select
              id="co-state"
              name="state"
              autoComplete="address-level1"
              value={form.state}
              onChange={set('state')}
              aria-invalid={!!errors.state}
              aria-describedby={errors.state ? 'co-state-err' : undefined}
              required
            >
              <option value="">Choose a state</option>
              {INDIAN_STATES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
            {errors.state && (
              <p id="co-state-err" className={styles.error}>
                {errors.state}
              </p>
            )}
          </div>
        </fieldset>

        <fieldset className={styles.section}>
          <legend>
            <span className={styles.num}>3</span> Payment
          </legend>
          <label className={styles.option}>
            <input
              type="radio"
              name="payment"
              value="online"
              checked={method === 'online'}
              onChange={() => setPayment('online')}
            />
            <span>Pay online (UPI, cards, netbanking)</span>
          </label>
          <label className={styles.option} data-disabled={cod ? undefined : ''}>
            <input
              type="radio"
              name="payment"
              value="cod"
              checked={method === 'cod'}
              disabled={!cod}
              onChange={() => setPayment('cod')}
            />
            <span>
              Cash on delivery
              {!cod && (
                <small className={styles.hint}>
                  Available on orders up to ₹{COD_LIMIT_INR.toLocaleString('en-IN')}.
                </small>
              )}
            </span>
          </label>
          {errors.payment && <p className={styles.error}>{errors.payment}</p>}
        </fieldset>

        <label className={styles.save}>
          <input type="checkbox" checked={save} onChange={(e) => setSave(e.target.checked)} />
          <span>Save my details on this device</span>
        </label>

        <div ref={turnstileEl} className={styles.turnstile} />

        <div className={styles.submit}>
          <Button
            type="submit"
            variant="primary"
            fullWidth
            disabled={busy || !cart}
            aria-busy={busy}
          >
            {busy
              ? 'One moment…'
              : method === 'online'
                ? `Pay ${rupees(total)} securely`
                : 'Place order · Cash on delivery'}
          </Button>
          <p className={styles.message} role="status" aria-live="polite">
            {message}
          </p>
          <p className={styles.hint}>
            Questions?{' '}
            <a href={site.whatsapp.url} target="_blank" rel="noopener noreferrer">
              WhatsApp us
            </a>
            . By placing the order you agree to our <Link href="/terms">terms</Link>.
          </p>
        </div>
      </form>

      <aside className={styles.summary} aria-label="Order summary">
        <button
          type="button"
          className={styles.toggle}
          aria-expanded={showOrder}
          aria-controls="co-summary"
          onClick={() => setShowOrder((v) => !v)}
        >
          <span>
            {showOrder ? 'Hide order' : 'Show order'} · {rupees(total)}
          </span>
          <span aria-hidden="true">{showOrder ? '−' : '+'}</span>
        </button>
        <div id="co-summary" className={styles.panel} data-open={showOrder ? '' : undefined}>
          <h2 className={styles.sumTitle}>Your order</h2>
          <ul className={styles.lines}>
            {lines.map((l) => (
              <li key={l.id} className={styles.line}>
                <div className={styles.thumb}>
                  {thumbOf(l) && (
                    <Image src={thumbOf(l)!} alt="" width={56} height={70} sizes="56px" />
                  )}
                </div>
                <div>
                  <p className={styles.lineTitle}>{l.merchandise.product.title}</p>
                  <p className={styles.lineMeta}>{l.merchandise.variantTitle}</p>
                  <div
                    className={styles.stepper}
                    role="group"
                    aria-label={`Quantity, ${l.merchandise.product.title}, ${l.merchandise.variantTitle}`}
                  >
                    <button
                      type="button"
                      onClick={() => (l.quantity > 1 ? update(l.id, l.quantity - 1) : remove(l.id))}
                      aria-label="Decrease quantity"
                    >
                      <MinusIcon size={16} />
                    </button>
                    <output aria-live="polite">{l.quantity}</output>
                    <button
                      type="button"
                      onClick={() => update(l.id, l.quantity + 1)}
                      disabled={l.quantity >= MAX_LINE_QUANTITY}
                      aria-label="Increase quantity"
                    >
                      <PlusIcon size={16} />
                    </button>
                  </div>
                </div>
                <p className={styles.lineTotal}>{rupees(paiseOf(l))}</p>
              </li>
            ))}
          </ul>
          <dl className={styles.totals}>
            <div>
              <dt>Subtotal</dt>
              <dd>{rupees(subtotal)}</dd>
            </div>
            <div>
              <dt>Shipping</dt>
              <dd>{shipping === 0 ? 'Free' : rupees(shipping)}</dd>
            </div>
            <div className={styles.total}>
              <dt>Total</dt>
              <dd data-total>{rupees(total)}</dd>
            </div>
          </dl>
          <p className={styles.hint}>All prices include GST.</p>
        </div>
      </aside>
    </div>
  );
}
