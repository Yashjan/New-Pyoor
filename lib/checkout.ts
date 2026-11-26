/**
 * The checkout's shared rules and shapes: the page (components/checkout) and the API
 * (server/) both use these, so a field is validated the same way on both sides. The server
 * always validates again and never trusts the client's prices.
 */
import { INDIAN_STATES } from '@/lib/india';

export const MAX_QTY = 20;
export const MAX_LINES = 10;

export type PaymentMethod = 'online' | 'cod';

export interface OrderRequest {
  idempotencyKey: string;
  items: { id: string; qty: number }[];
  contact: { name: string; phone: string; email: string };
  address: {
    line1: string;
    line2: string;
    landmark: string;
    pincode: string;
    city: string;
    state: string;
  };
  payment: PaymentMethod;
  /** what the customer saw; the order is refused if the server's total differs */
  expectedTotalPaise: number;
  turnstileToken: string;
}

export type FieldErrors = Partial<Record<string, string>>;

const str = (v: unknown) => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ') : '');

/** "98765 43210", "+91 98765-43210", "098765…" → "9876543210", or '' if not a mobile number. */
export function normalisePhone(v: string): string {
  const d = v.replace(/[\s\-()]/g, '').replace(/^(\+?91|0)(?=\d{10}$)/, '');
  return /^[6-9]\d{9}$/.test(d) ? d : '';
}

const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[a-z]{2,}$/i;

/** The contact and address fields' errors (empty object: all valid). */
export function fieldErrors(contact: OrderRequest['contact'], address: OrderRequest['address']) {
  const e: FieldErrors = {};
  if (contact.name.length < 2) e.name = 'Please enter your name.';
  else if (contact.name.length > 80) e.name = 'Please shorten your name to 80 characters.';
  if (!normalisePhone(contact.phone)) e.phone = 'Enter a 10-digit mobile number.';
  if (contact.email && (!EMAIL.test(contact.email) || contact.email.length > 120))
    e.email = 'This email doesn’t look right.';
  if (!address.line1) e.line1 = 'Please enter your house or flat.';
  else if (address.line1.length > 120) e.line1 = 'Please shorten this to 120 characters.';
  if (!address.line2) e.line2 = 'Please enter the street or area.';
  else if (address.line2.length > 120) e.line2 = 'Please shorten this to 120 characters.';
  if (address.landmark.length > 120) e.landmark = 'Please shorten this to 120 characters.';
  if (!/^[1-9]\d{5}$/.test(address.pincode)) e.pincode = 'Enter a 6-digit pincode.';
  if (!address.city) e.city = 'Please enter your city.';
  else if (address.city.length > 60) e.city = 'Please shorten this to 60 characters.';
  if (!(INDIAN_STATES as readonly string[]).includes(address.state))
    e.state = 'Please choose your state.';
  return e;
}

/**
 * Parses and validates an order request (the API's first step). Returns the cleaned request,
 * or the errors: per field, or `form` for the request as a whole.
 */
export function parseOrderRequest(
  body: unknown,
): { ok: true; value: OrderRequest } | { ok: false; errors: FieldErrors } {
  const b = (body ?? {}) as Record<string, unknown>;
  const c = (b.contact ?? {}) as Record<string, unknown>;
  const a = (b.address ?? {}) as Record<string, unknown>;
  const contact = { name: str(c.name), phone: str(c.phone), email: str(c.email).toLowerCase() };
  const address = {
    line1: str(a.line1),
    line2: str(a.line2),
    landmark: str(a.landmark),
    pincode: str(a.pincode),
    city: str(a.city),
    state: str(a.state),
  };
  const errors = fieldErrors(contact, address);

  const key = str(b.idempotencyKey);
  if (!/^[A-Za-z0-9-]{16,64}$/.test(key)) errors.form = 'Please reload the page and try again.';
  const payment = b.payment;
  if (payment !== 'online' && payment !== 'cod') errors.payment = 'Please choose how to pay.';
  const token = str(b.turnstileToken);
  if (!token || token.length > 2048) errors.form = 'Please wait a moment and try again.';
  const expected = b.expectedTotalPaise;
  if (!Number.isSafeInteger(expected) || (expected as number) < 0)
    errors.form = 'Please reload the page and try again.';

  const raw = Array.isArray(b.items) ? b.items : [];
  const items: OrderRequest['items'] = [];
  for (const it of raw.slice(0, MAX_LINES + 1)) {
    const id = str((it as Record<string, unknown>)?.id);
    const qty = (it as Record<string, unknown>)?.qty;
    if (!/^[a-z0-9-]{1,64}$/.test(id) || !Number.isInteger(qty) || (qty as number) < 1)
      errors.items = 'Your bag has an item we can’t read. Please remove it and add it again.';
    else if ((qty as number) > MAX_QTY) errors.items = `At most ${MAX_QTY} of each item.`;
    else if (items.some((x) => x.id === id)) errors.items = 'An item appears twice in your bag.';
    else items.push({ id, qty: qty as number });
  }
  if (raw.length === 0) errors.items = 'Your bag is empty.';
  if (raw.length > MAX_LINES) errors.items = `At most ${MAX_LINES} different items.`;

  if (Object.keys(errors).length) return { ok: false, errors };
  return {
    ok: true,
    value: {
      idempotencyKey: key,
      items,
      contact: { ...contact, phone: normalisePhone(contact.phone) },
      address,
      payment: payment as PaymentMethod,
      expectedTotalPaise: expected as number,
      turnstileToken: token,
    },
  };
}

/** The confirmation page's view of an order (GET /api/orders/:ref). */
export interface OrderView {
  ref: string;
  status: string;
  payment: PaymentMethod;
  items: { id: string; name: string; format: 'jar' | 'pouch'; qty: number; unitPaise: number }[];
  subtotalPaise: number;
  shippingPaise: number;
  totalPaise: number;
  name: string;
  address: string[];
  createdAt: string;
}

/** The cart's variant id ('local:variant:x') → the API's product id ('x'). */
export const apiProductId = (variantId: string) => variantId.replace(/^local:variant:/, '');

export const rupees = (paise: number) =>
  `₹${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
