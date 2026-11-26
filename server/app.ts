import type { D1Database } from '@cloudflare/workers-types';
import { Hono, type Context } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { validator } from 'hono/validator';
import { parseOrderRequest, type OrderView } from '../lib/checkout';
import {
  publicRef,
  randomToken,
  safeEqual,
  verifyPaymentSignature,
  verifyWebhookSignature,
} from './crypto';
import { createRazorpayOrder, verifyTurnstile } from './external';
import { quote, type PriceRow } from './quote';
import { allow } from './ratelimit';
import { processWebhook, type RazorpayEvent } from './webhook';

/** The Pages Functions' bindings (wrangler.toml) and secrets (.dev.vars / the dashboard). */
export type Env = {
  DB: D1Database;
  RAZORPAY_KEY_ID?: string;
  RAZORPAY_KEY_SECRET?: string;
  RAZORPAY_WEBHOOK_SECRET?: string;
  TURNSTILE_SECRET_KEY?: string;
  ADMIN_TOKEN?: string;
  ADMIN_EMAIL?: string;
};

export type ProductRow = {
  id: string;
  slug: string;
  name: string;
  format: 'jar' | 'pouch';
  price_paise: number | null;
};

type C = Context<{ Bindings: Env }>;

const FORMATS = ['jar', 'pouch'] as const;
export const STATUSES = [
  'pending',
  'paid',
  'cod_confirmed',
  'packed',
  'shipped',
  'delivered',
  'cancelled',
] as const;
type Status = (typeof STATUSES)[number];

/** The admin's status buttons: which status may follow which. */
export const NEXT_STATUS: Record<Status, Status[]> = {
  pending: ['cancelled'],
  paid: ['packed', 'cancelled'],
  cod_confirmed: ['packed', 'cancelled'],
  packed: ['shipped', 'cancelled'],
  shipped: ['delivered'],
  delivered: [],
  cancelled: [],
};

const NOW = "strftime('%Y-%m-%dT%H:%M:%fZ', 'now')";
const ip = (c: C) => c.req.header('cf-connecting-ip') ?? 'local';
const fail = (
  c: C,
  status: 400 | 401 | 403 | 404 | 409 | 413 | 429 | 502 | 503,
  error: string,
  extra = {},
) => c.json({ error, ...extra }, status);

/** Per-IP limits on the POST endpoints (requests per window). */
const limit =
  (route: string, n: number, windowSec: number) => async (c: C, next: () => Promise<void>) => {
    if (!(await allow(c.env.DB, `${route}:${ip(c)}`, n, windowSec)))
      return fail(c, 429, 'Too many requests. Please wait a few minutes and try again.');
    await next();
  };
const small = (maxSize: number) =>
  bodyLimit({ maxSize, onError: (c) => c.json({ error: 'Request too large.' }, 413) });

/**
 * The API (/api/*). Kept light: the free plan gives a request 10 ms of CPU (waiting on D1 or
 * Razorpay doesn't count), so plain SQL, WebCrypto, no ORM, no rendering.
 */
export const app = new Hono<{ Bindings: Env }>().basePath('/api');

app.use('*', async (c, next) => {
  await next();
  c.header('Cache-Control', 'no-store');
  c.header('X-Content-Type-Options', 'nosniff');
});

app.get('/health', async (c) => {
  let db = false;
  try {
    db = (await c.env.DB.prepare('SELECT 1 AS ok').first<{ ok: number }>())?.ok === 1;
  } catch {
    db = false;
  }
  return c.json({ ok: true, db }, db ? 200 : 503);
});

app.get(
  '/products',
  validator('query', (q, c) => {
    const format = q.format;
    if (format !== undefined && !FORMATS.includes(format as (typeof FORMATS)[number]))
      return c.json({ error: 'format must be jar or pouch' }, 400);
    return { format: format as (typeof FORMATS)[number] | undefined };
  }),
  async (c) => {
    const { format } = c.req.valid('query');
    const sql =
      'SELECT id, slug, name, format, price_paise FROM products WHERE active = 1' +
      (format ? ' AND format = ?' : '') +
      ' ORDER BY slug, format';
    const stmt = c.env.DB.prepare(sql);
    const { results } = await (format ? stmt.bind(format) : stmt).all<ProductRow>();
    return c.json({ products: results });
  },
);

// ---------------------------------------------------------------- orders

type OrderRow = {
  id: number;
  public_ref: string;
  status: Status;
  payment_method: 'online' | 'cod';
  subtotal_paise: number;
  shipping_paise: number;
  total_paise: number;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  address_line1: string;
  address_line2: string | null;
  landmark: string | null;
  city: string;
  state: string;
  pincode: string;
  razorpay_order_id: string | null;
  razorpay_payment_id: string | null;
  access_token: string;
  tracking_number: string | null;
  created_at: string;
  updated_at: string;
};

/** The answer to POST /api/orders, for a new order or a repeated request (same idempotency key). */
async function orderResponse(c: C, o: OrderRow) {
  const base = {
    ref: o.public_ref,
    token: o.access_token,
    payment: o.payment_method,
    status: o.status,
  };
  if (o.payment_method === 'cod' || o.status !== 'pending') return c.json(base);
  const { RAZORPAY_KEY_ID: keyId, RAZORPAY_KEY_SECRET: secret } = c.env;
  if (!keyId || !secret)
    return fail(c, 503, 'Online payment isn’t set up yet. Please choose cash on delivery.');
  let rzp = o.razorpay_order_id;
  if (!rzp) {
    rzp = await createRazorpayOrder(keyId, secret, o.total_paise, o.public_ref);
    if (!rzp) return fail(c, 502, 'We couldn’t reach the payment service. Please try again.');
    await c.env.DB.prepare(
      `UPDATE orders SET razorpay_order_id = ?, updated_at = ${NOW} WHERE id = ?`,
    )
      .bind(rzp, o.id)
      .run();
  }
  return c.json({ ...base, razorpayOrderId: rzp, keyId, amount: o.total_paise });
}

app.post('/orders', small(16 * 1024), limit('orders', 20, 600), async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return fail(c, 400, 'invalid json');
  }
  const parsed = parseOrderRequest(body);
  if (!parsed.ok) return fail(c, 400, 'invalid', { fields: parsed.errors });
  const r = parsed.value;
  const db = c.env.DB;

  const byKey = () =>
    db
      .prepare('SELECT * FROM orders WHERE idempotency_key = ?')
      .bind(r.idempotencyKey)
      .first<OrderRow>();
  const existing = await byKey();
  if (existing) return orderResponse(c, existing);

  if (!c.env.TURNSTILE_SECRET_KEY) return fail(c, 503, 'Checkout isn’t set up yet.');
  if (
    !(await verifyTurnstile(
      c.env.TURNSTILE_SECRET_KEY,
      r.turnstileToken,
      c.req.header('cf-connecting-ip') ?? null,
    ))
  )
    return fail(c, 403, 'We couldn’t confirm you’re not a robot. Please try again.');

  const ids = r.items.map((i) => i.id);
  const { results: rows } = await db
    .prepare(
      `SELECT id, name, format, price_paise, active FROM products WHERE id IN (${ids.map(() => '?').join(',')})`,
    )
    .bind(...ids)
    .all<PriceRow>();
  const q = quote(r.items, rows);
  if (!q.ok) return fail(c, 409, 'unavailable', { unavailable: q.unavailable });
  const { quote: total } = q;
  // the customer must have seen this total: a changed price (or a tampered one) stops here
  if (total.totalPaise !== r.expectedTotalPaise)
    return fail(c, 409, 'prices_changed', {
      subtotalPaise: total.subtotalPaise,
      shippingPaise: total.shippingPaise,
      totalPaise: total.totalPaise,
    });
  if (r.payment === 'cod' && !total.codAllowed)
    return fail(c, 400, 'invalid', {
      fields: { payment: 'Cash on delivery is for orders up to ₹2,000.' },
    });

  const token = randomToken();
  for (let attempt = 0; attempt < 4; attempt++) {
    const ref = publicRef();
    try {
      await db.batch([
        db
          .prepare(
            `INSERT INTO orders (public_ref, status, payment_method, subtotal_paise, shipping_paise, total_paise,
               customer_name, customer_phone, customer_email, address_line1, address_line2, landmark, city, state,
               pincode, access_token, idempotency_key)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .bind(
            ref,
            r.payment === 'cod' ? 'cod_confirmed' : 'pending',
            r.payment,
            total.subtotalPaise,
            total.shippingPaise,
            total.totalPaise,
            r.contact.name,
            `+91${r.contact.phone}`,
            r.contact.email || null,
            r.address.line1,
            r.address.line2,
            r.address.landmark || null,
            r.address.city,
            r.address.state,
            r.address.pincode,
            token,
            r.idempotencyKey,
          ),
        ...total.lines.map((l) =>
          db
            .prepare(
              'INSERT INTO order_items (order_id, product_id, qty, unit_price_paise) SELECT id, ?, ?, ? FROM orders WHERE public_ref = ?',
            )
            .bind(l.id, l.qty, l.unitPaise, ref),
        ),
        db
          .prepare(
            "INSERT INTO events (order_id, type, payload) SELECT id, 'order.created', ? FROM orders WHERE public_ref = ?",
          )
          .bind(JSON.stringify({ payment: r.payment, total_paise: total.totalPaise }), ref),
      ]);
      const created = await byKey();
      return orderResponse(c, created!);
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      if (msg.includes('idempotency_key')) {
        // a double click won the race: answer with its order
        const o = await byKey();
        if (o) return orderResponse(c, o);
      }
      if (!msg.includes('public_ref')) throw e;
      // a reference collision: try another
    }
  }
  throw new Error('could not allocate an order reference');
});

async function orderByToken(c: C, ref: string, token: string) {
  if (!/^PY-[A-Z0-9]{5}$/.test(ref) || !token) return null;
  const o = await c.env.DB.prepare('SELECT * FROM orders WHERE public_ref = ?')
    .bind(ref)
    .first<OrderRow>();
  return o && safeEqual(o.access_token, token) ? o : null;
}

async function view(db: D1Database, o: OrderRow): Promise<OrderView> {
  const { results } = await db
    .prepare(
      `SELECT i.product_id AS id, p.name, p.format, i.qty, i.unit_price_paise AS unitPaise
       FROM order_items i JOIN products p ON p.id = i.product_id WHERE i.order_id = ? ORDER BY p.slug, p.format`,
    )
    .bind(o.id)
    .all<OrderView['items'][number]>();
  return {
    ref: o.public_ref,
    status: o.status,
    payment: o.payment_method,
    items: results,
    subtotalPaise: o.subtotal_paise,
    shippingPaise: o.shipping_paise,
    totalPaise: o.total_paise,
    name: o.customer_name,
    address: [
      o.address_line1,
      o.address_line2,
      o.landmark ? `Near ${o.landmark}` : null,
      `${o.city}, ${o.state} ${o.pincode}`,
    ].filter((x): x is string => !!x),
    createdAt: o.created_at,
  };
}

app.get('/orders/:ref', async (c) => {
  const o = await orderByToken(c, c.req.param('ref'), c.req.query('token') ?? '');
  if (!o) return fail(c, 404, 'not found');
  return c.json(await view(c.env.DB, o));
});

// ---------------------------------------------------------------- payments

app.post('/payments/verify', small(4 * 1024), limit('verify', 30, 600), async (c) => {
  const b = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const s = (k: string) => (typeof b[k] === 'string' ? (b[k] as string) : '');
  const o = await orderByToken(c, s('ref'), s('token'));
  if (!o || !o.razorpay_order_id || o.razorpay_order_id !== s('razorpay_order_id'))
    return fail(c, 404, 'not found');
  const secret = c.env.RAZORPAY_KEY_SECRET ?? '';
  if (
    !(await verifyPaymentSignature(
      secret,
      o.razorpay_order_id,
      s('razorpay_payment_id'),
      s('razorpay_signature'),
    ))
  )
    return fail(c, 400, 'invalid signature');
  const db = c.env.DB;
  const res = await db
    .prepare(
      `UPDATE orders SET status = 'paid', razorpay_payment_id = ?, updated_at = ${NOW} WHERE id = ? AND status = 'pending'`,
    )
    .bind(s('razorpay_payment_id'), o.id)
    .run();
  if (res.meta.changes)
    await db
      .prepare("INSERT INTO events (order_id, type, payload) VALUES (?, 'payment.verified', ?)")
      .bind(o.id, JSON.stringify({ payment_id: s('razorpay_payment_id') }))
      .run();
  return c.json({ ok: true, status: res.meta.changes ? 'paid' : o.status });
});

app.post('/webhooks/razorpay', small(64 * 1024), limit('webhook', 600, 600), async (c) => {
  const secret = c.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) return fail(c, 503, 'not configured');
  const raw = await c.req.text();
  if (!(await verifyWebhookSignature(secret, raw, c.req.header('x-razorpay-signature') ?? '')))
    return fail(c, 400, 'invalid signature');
  let ev: RazorpayEvent;
  try {
    ev = JSON.parse(raw) as RazorpayEvent;
  } catch {
    return fail(c, 400, 'invalid json');
  }
  const id =
    c.req.header('x-razorpay-event-id') ?? `${ev.event}:${ev.payload?.payment?.entity?.id ?? ''}`;
  return c.json({ ok: true, result: await processWebhook(c.env.DB, ev, id.slice(0, 100)) });
});

// ---------------------------------------------------------------- admin

/**
 * /api/admin/*: a Bearer ADMIN_TOKEN on every request. In production the path also sits behind
 * Cloudflare Access (DEPLOY.md); this check stays as the second lock.
 */
app.use('/admin/*', limit('admin', 240, 600), async (c, next) => {
  const want = c.env.ADMIN_TOKEN ?? '';
  if (want.length < 16) return fail(c, 503, 'ADMIN_TOKEN is not set');
  const got = (c.req.header('authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!safeEqual(got, want)) return fail(c, 401, 'unauthorized');
  await next();
});

const adminRow = (o: OrderRow) => ({
  ref: o.public_ref,
  status: o.status,
  payment: o.payment_method,
  totalPaise: o.total_paise,
  name: o.customer_name,
  phone: o.customer_phone,
  city: o.city,
  createdAt: o.created_at,
});

app.get('/admin/orders', async (c) => {
  const status = c.req.query('status');
  if (status && !STATUSES.includes(status as Status)) return fail(c, 400, 'unknown status');
  const stmt = c.env.DB.prepare(
    `SELECT * FROM orders ${status ? 'WHERE status = ?' : ''} ORDER BY created_at DESC, id DESC LIMIT 500`,
  );
  const { results } = await (status ? stmt.bind(status) : stmt).all<OrderRow>();
  return c.json({ orders: results.map(adminRow) });
});

const cell = (v: unknown) => {
  let s = v == null ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // no formulas when opened in a spreadsheet
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

app.get('/admin/orders.csv', async (c) => {
  const db = c.env.DB;
  const { results } = await db
    .prepare('SELECT * FROM orders ORDER BY created_at DESC, id DESC')
    .all<OrderRow>();
  const { results: items } = await db
    .prepare(
      'SELECT i.order_id, p.name, p.format, i.qty FROM order_items i JOIN products p ON p.id = i.product_id',
    )
    .all<{ order_id: number; name: string; format: string; qty: number }>();
  const head = [
    'ref',
    'created_at',
    'status',
    'payment',
    'subtotal_inr',
    'shipping_inr',
    'total_inr',
    'name',
    'phone',
    'email',
    'address_line1',
    'address_line2',
    'landmark',
    'city',
    'state',
    'pincode',
    'items',
    'tracking',
    'razorpay_payment_id',
  ];
  const lines = results.map((o) =>
    [
      o.public_ref,
      o.created_at,
      o.status,
      o.payment_method,
      o.subtotal_paise / 100,
      o.shipping_paise / 100,
      o.total_paise / 100,
      o.customer_name,
      o.customer_phone,
      o.customer_email,
      o.address_line1,
      o.address_line2,
      o.landmark,
      o.city,
      o.state,
      o.pincode,
      items
        .filter((i) => i.order_id === o.id)
        .map((i) => `${i.name} (${i.format}) x${i.qty}`)
        .join('; '),
      o.tracking_number,
      o.razorpay_payment_id,
    ]
      .map(cell)
      .join(','),
  );
  return c.body([head.join(','), ...lines].join('\r\n') + '\r\n', 200, {
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': 'attachment; filename="pyoor-orders.csv"',
  });
});

app.get('/admin/orders/:ref', async (c) => {
  const db = c.env.DB;
  const o = await db
    .prepare('SELECT * FROM orders WHERE public_ref = ?')
    .bind(c.req.param('ref'))
    .first<OrderRow>();
  if (!o) return fail(c, 404, 'not found');
  const { results: events } = await db
    .prepare('SELECT type, payload, created_at FROM events WHERE order_id = ? ORDER BY id')
    .bind(o.id)
    .all<{ type: string; payload: string | null; created_at: string }>();
  return c.json({
    ...(await view(db, o)),
    phone: o.customer_phone,
    email: o.customer_email,
    tracking: o.tracking_number,
    razorpayOrderId: o.razorpay_order_id,
    razorpayPaymentId: o.razorpay_payment_id,
    next: NEXT_STATUS[o.status],
    events,
  });
});

app.post('/admin/orders/:ref/status', small(2 * 1024), async (c) => {
  const db = c.env.DB;
  const b = (await c.req.json().catch(() => ({}))) as { status?: string; tracking?: string };
  const o = await db
    .prepare('SELECT * FROM orders WHERE public_ref = ?')
    .bind(c.req.param('ref'))
    .first<OrderRow>();
  if (!o) return fail(c, 404, 'not found');
  const to = b.status as Status;
  if (!NEXT_STATUS[o.status].includes(to))
    return fail(c, 409, `can’t go from ${o.status} to ${b.status}`);
  const tracking = typeof b.tracking === 'string' ? b.tracking.trim().slice(0, 64) : '';
  if (to === 'shipped' && !tracking) return fail(c, 400, 'a tracking number is needed');
  const res = await db
    .prepare(
      `UPDATE orders SET status = ?, tracking_number = COALESCE(?, tracking_number), updated_at = ${NOW}
       WHERE id = ? AND status = ?`,
    )
    .bind(to, tracking || null, o.id, o.status)
    .run();
  if (!res.meta.changes) return fail(c, 409, 'the order changed; reload it');
  await db
    .prepare('INSERT INTO events (order_id, type, payload) VALUES (?, ?, ?)')
    .bind(
      o.id,
      `status.${to}`,
      JSON.stringify({ from: o.status, to, ...(tracking ? { tracking } : {}) }),
    )
    .run();
  return c.json({ ok: true, status: to });
});

app.notFound((c) => c.json({ error: 'not found' }, 404));
app.onError((err, c) => {
  // the message only: never the request, its headers or any secret
  console.error('api error:', err.message);
  return c.json({ error: 'server error' }, 500);
});
