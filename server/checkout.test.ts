import { createHmac } from 'node:crypto';
import type { D1Database } from '@cloudflare/workers-types';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { codAllowed, shippingPaise } from '../lib/commerce/pricing';
import { normalisePhone, parseOrderRequest } from '../lib/checkout';
import { app, type Env } from './app';
import {
  hmacSha256Hex,
  publicRef,
  safeEqual,
  verifyPaymentSignature,
  verifyWebhookSignature,
} from './crypto';
import { quote, type PriceRow } from './quote';
import { processWebhook } from './webhook';

type Kind = 'first' | 'all' | 'run';
type Handler = (sql: string, args: unknown[], kind: Kind) => unknown;

/** A D1 stand-in: every query goes to `handler`, which answers by its SQL. */
function fakeDb(handler: Handler) {
  const log: { sql: string; args: unknown[]; kind: Kind }[] = [];
  const stmt = (sql: string, args: unknown[] = []) => ({
    sql,
    args,
    bind: (...a: unknown[]) => stmt(sql, a),
    first: async () => (
      log.push({ sql, args, kind: 'first' }),
      handler(sql, args, 'first') ?? null
    ),
    all: async () => (
      log.push({ sql, args, kind: 'all' }),
      { results: (handler(sql, args, 'all') as unknown[]) ?? [] }
    ),
    run: async () => (
      log.push({ sql, args, kind: 'run' }),
      (handler(sql, args, 'run') as object) ?? { meta: { changes: 1 } }
    ),
  });
  const db = {
    prepare: (sql: string) => stmt(sql),
    batch: async (list: ReturnType<typeof stmt>[]) => Promise.all(list.map((s) => s.run())),
  };
  return { db: db as unknown as D1Database, log };
}

const ROWS: PriceRow[] = [
  {
    id: 'herbal-black-salt-1kg',
    name: 'Herbal Black Salt',
    format: 'jar',
    price_paise: 19900,
    active: 1,
  },
  {
    id: 'natural-lake-salt-pouch-1kg',
    name: 'Natural Lake Salt',
    format: 'pouch',
    price_paise: 14900,
    active: 1,
  },
  { id: 'the-sambhar-pair', name: 'The Sambhar Pair', format: 'jar', price_paise: null, active: 0 },
];

afterEach(() => vi.unstubAllGlobals());

describe('pricing', () => {
  it('shipping: ₹49 below ₹499, free from ₹499, nothing on an empty bag', () => {
    expect(shippingPaise(0)).toBe(0);
    expect(shippingPaise(19900)).toBe(4900);
    expect(shippingPaise(49899)).toBe(4900);
    expect(shippingPaise(49900)).toBe(0);
    expect(shippingPaise(100000)).toBe(0);
  });

  it('cash on delivery up to ₹2,000 total', () => {
    expect(codAllowed(200000)).toBe(true);
    expect(codAllowed(200001)).toBe(false);
  });

  it('quotes from the database rows: lines, subtotal, shipping, total', () => {
    const q = quote(
      [
        { id: 'herbal-black-salt-1kg', qty: 2 },
        { id: 'natural-lake-salt-pouch-1kg', qty: 1 },
      ],
      ROWS,
    );
    expect(q.ok && q.quote).toMatchObject({
      subtotalPaise: 2 * 19900 + 14900,
      shippingPaise: 0,
      totalPaise: 2 * 19900 + 14900,
      codAllowed: true,
    });
    const big = quote([{ id: 'herbal-black-salt-1kg', qty: 11 }], ROWS);
    expect(big.ok && big.quote).toMatchObject({
      shippingPaise: 0,
      totalPaise: 218900,
      codAllowed: false,
    });
  });

  it('refuses unknown, inactive and unpriced products', () => {
    expect(quote([{ id: 'the-sambhar-pair', qty: 1 }], ROWS)).toEqual({
      ok: false,
      unavailable: ['the-sambhar-pair'],
    });
    expect(quote([{ id: 'gold-salt', qty: 1 }], ROWS)).toEqual({
      ok: false,
      unavailable: ['gold-salt'],
    });
  });
});

const good = () => ({
  idempotencyKey: 'a1b2c3d4-e5f6-4789-abcd-ef0123456789',
  items: [{ id: 'herbal-black-salt-1kg', qty: 2 }],
  contact: { name: 'Asha Verma', phone: '+91 98765 43210', email: '' },
  address: {
    line1: '12, Rose Villa',
    line2: 'MG Road',
    landmark: '',
    pincode: '302001',
    city: 'Jaipur',
    state: 'Rajasthan',
  },
  payment: 'cod',
  expectedTotalPaise: 2 * 19900 + 4900,
  turnstileToken: 'XXXX.DUMMY.TOKEN.XXXX',
});

describe('validation', () => {
  it('normalises Indian mobile numbers', () => {
    expect(normalisePhone('+91 98765 43210')).toBe('9876543210');
    expect(normalisePhone('098765-43210')).toBe('9876543210');
    expect(normalisePhone('12345 67890')).toBe('');
    expect(normalisePhone('98765')).toBe('');
  });

  it('accepts a complete order and cleans it', () => {
    const r = parseOrderRequest(good());
    expect(r.ok && r.value.contact.phone).toBe('9876543210');
  });

  it('names each bad field', () => {
    const b = good();
    b.contact.phone = '12345';
    b.address.pincode = '02000';
    b.address.state = 'Atlantis';
    b.contact.email = 'not-an-email';
    const r = parseOrderRequest(b);
    expect(r.ok).toBe(false);
    expect(!r.ok && Object.keys(r.errors).sort()).toEqual(['email', 'phone', 'pincode', 'state']);
  });

  it('refuses bad items: empty, duplicate, too many, fractional', () => {
    for (const items of [
      [],
      [
        { id: 'herbal-black-salt-1kg', qty: 1 },
        { id: 'herbal-black-salt-1kg', qty: 1 },
      ],
      [{ id: 'herbal-black-salt-1kg', qty: 21 }],
      [{ id: 'herbal-black-salt-1kg', qty: 1.5 }],
    ]) {
      const r = parseOrderRequest({ ...good(), items });
      expect(!r.ok && r.errors.items, JSON.stringify(items)).toBeTruthy();
    }
  });
});

describe('signatures', () => {
  it('HMAC-SHA256 matches RFC 4231 test case 2', async () => {
    expect(await hmacSha256Hex('Jefe', 'what do ya want for nothing?')).toBe(
      '5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843',
    );
  });

  it('verifies a Razorpay payment signature, and only the right one', async () => {
    const secret = 'test_secret_123';
    const sig = createHmac('sha256', secret).update('order_ABC|pay_XYZ').digest('hex');
    expect(await verifyPaymentSignature(secret, 'order_ABC', 'pay_XYZ', sig)).toBe(true);
    expect(await verifyPaymentSignature(secret, 'order_ABC', 'pay_OTHER', sig)).toBe(false);
    expect(await verifyPaymentSignature('other', 'order_ABC', 'pay_XYZ', sig)).toBe(false);
    expect(await verifyPaymentSignature(secret, 'order_ABC', 'pay_XYZ', 'zz')).toBe(false);
    expect(await verifyPaymentSignature('', 'order_ABC', 'pay_XYZ', sig)).toBe(false);
  });

  it('verifies a webhook signature over the raw body', async () => {
    const body = '{"event":"payment.captured"}';
    const sig = createHmac('sha256', 'whsec').update(body).digest('hex');
    expect(await verifyWebhookSignature('whsec', body, sig)).toBe(true);
    expect(await verifyWebhookSignature('whsec', body + ' ', sig)).toBe(false);
    expect(await verifyWebhookSignature('', body, sig)).toBe(false);
  });

  it('safeEqual compares whole strings', () => {
    expect(safeEqual('abc', 'abc')).toBe(true);
    expect(safeEqual('abc', 'abd')).toBe(false);
    expect(safeEqual('abc', 'abcd')).toBe(false);
    expect(safeEqual('', '')).toBe(true);
  });

  it('public refs look like PY-24A7K', () => {
    for (let i = 0; i < 50; i++) expect(publicRef()).toMatch(/^PY-[2-9A-HJKMNP-TV-Z]{5}$/);
  });
});

/** An in-memory order and event log for the webhook. */
function webhookDb() {
  const order = { id: 7, status: 'pending', total_paise: 44700, payment_id: null as string | null };
  const seen = new Set<string>();
  const events: string[] = [];
  const { db } = fakeDb((sql, args) => {
    if (sql.startsWith('SELECT id, status, total_paise FROM orders'))
      return args[0] === 'order_1' ? order : null;
    if (sql.startsWith('INSERT OR IGNORE INTO events')) {
      const id = args[3] as string;
      if (seen.has(id)) return { meta: { changes: 0 } };
      seen.add(id);
      events.push(args[1] as string);
      return { meta: { changes: 1 } };
    }
    if (sql.startsWith("UPDATE orders SET status = 'paid'")) {
      if (order.status !== 'pending') return { meta: { changes: 0 } };
      order.status = 'paid';
      order.payment_id = args[0] as string;
      return { meta: { changes: 1 } };
    }
    throw new Error('unexpected sql: ' + sql);
  });
  return { db, order, events };
}

const captured = (amount = 44700) => ({
  event: 'payment.captured',
  payload: { payment: { entity: { id: 'pay_1', order_id: 'order_1', amount } } },
});

describe('webhook', () => {
  it('marks a pending order paid once; a redelivery changes nothing', async () => {
    const { db, order, events } = webhookDb();
    expect(await processWebhook(db, captured(), 'evt_1')).toBe('applied');
    expect(order).toMatchObject({ status: 'paid', payment_id: 'pay_1' });
    expect(await processWebhook(db, captured(), 'evt_1')).toBe('duplicate');
    expect(events).toEqual(['payment.captured']);
  });

  it('a failed payment is logged; the order stays pending', async () => {
    const { db, order, events } = webhookDb();
    const ev = { event: 'payment.failed', payload: captured().payload };
    expect(await processWebhook(db, ev, 'evt_2')).toBe('applied');
    expect(order.status).toBe('pending');
    expect(events).toEqual(['payment.failed']);
  });

  it('a captured amount that differs from the order is not marked paid', async () => {
    const { db, order, events } = webhookDb();
    await processWebhook(db, captured(100), 'evt_3');
    expect(order.status).toBe('pending');
    expect(events).toEqual(['payment.amount_mismatch']);
  });

  it('ignores other events and unknown orders', async () => {
    const { db } = webhookDb();
    expect(await processWebhook(db, { event: 'refund.created' }, 'e')).toBe('ignored');
    const other = captured();
    other.payload.payment.entity.order_id = 'order_2';
    expect(await processWebhook(db, other, 'e2')).toBe('ignored');
  });

  it('the endpoint refuses a bad signature', async () => {
    const { db } = webhookDb();
    const env = { DB: rateLimited(db), RAZORPAY_WEBHOOK_SECRET: 'whsec' } as unknown as Env;
    const res = await app.request(
      '/api/webhooks/razorpay',
      {
        method: 'POST',
        body: JSON.stringify(captured()),
        headers: { 'x-razorpay-signature': 'a'.repeat(64) },
      },
      env,
    );
    expect(res.status).toBe(400);
  });
});

/** Wraps a db so the rate limiter's upsert answers (count 1) without the handler knowing. */
function rateLimited(db: D1Database, count = 1): D1Database {
  return {
    ...db,
    batch: db.batch,
    prepare: (sql: string) =>
      sql.startsWith('INSERT INTO rate_limits') || sql.startsWith('DELETE FROM rate_limits')
        ? fakeDb(() => ({ count })).db.prepare(sql)
        : db.prepare(sql),
  } as D1Database;
}

const ORDER = {
  id: 1,
  public_ref: 'PY-24A7K',
  status: 'cod_confirmed',
  payment_method: 'cod',
  subtotal_paise: 39800,
  shipping_paise: 4900,
  total_paise: 44700,
  customer_name: 'Asha Verma',
  customer_phone: '+919876543210',
  customer_email: null,
  address_line1: '12, Rose Villa',
  address_line2: 'MG Road',
  landmark: null,
  city: 'Jaipur',
  state: 'Rajasthan',
  pincode: '302001',
  razorpay_order_id: null,
  razorpay_payment_id: null,
  access_token: 'tok_right_0123456789',
  tracking_number: null,
  created_at: '2026-11-26T10:00:00.000Z',
  updated_at: '2026-11-26T10:00:00.000Z',
};

describe('tokens', () => {
  const env = (extra: Partial<Env> = {}) => {
    const { db } = fakeDb((sql, args) => {
      if (sql.startsWith('SELECT * FROM orders WHERE public_ref'))
        return args[0] === ORDER.public_ref ? ORDER : null;
      if (sql.includes('FROM order_items')) return [];
      if (sql.startsWith('SELECT * FROM orders')) return [ORDER];
      return null;
    });
    return { DB: rateLimited(db), ...extra } as Env;
  };

  it('the order page needs the order’s own token', async () => {
    const ok = await app.request('/api/orders/PY-24A7K?token=tok_right_0123456789', {}, env());
    expect(ok.status).toBe(200);
    expect(await ok.json()).toMatchObject({ ref: 'PY-24A7K', totalPaise: 44700 });
    for (const q of ['?token=tok_wrong_0123456789', '?token=', '']) {
      const res = await app.request(`/api/orders/PY-24A7K${q}`, {}, env());
      expect(res.status, q).toBe(404);
    }
  });

  it('admin: 503 without ADMIN_TOKEN, 401 with a wrong one, 200 with the right one', async () => {
    const T = 'admin-token-0123456789abcdef';
    expect((await app.request('/api/admin/orders', {}, env())).status).toBe(503);
    const wrong = await app.request(
      '/api/admin/orders',
      { headers: { Authorization: 'Bearer nope' } },
      env({ ADMIN_TOKEN: T }),
    );
    expect(wrong.status).toBe(401);
    const none = await app.request('/api/admin/orders', {}, env({ ADMIN_TOKEN: T }));
    expect(none.status).toBe(401);
    const right = await app.request(
      '/api/admin/orders',
      { headers: { Authorization: `Bearer ${T}` } },
      env({ ADMIN_TOKEN: T }),
    );
    expect(right.status).toBe(200);
    expect(((await right.json()) as { orders: unknown[] }).orders).toHaveLength(1);
  });
});

describe('POST /api/orders', () => {
  const env = (inserted: string[] = []) => {
    const { db } = fakeDb((sql, args) => {
      if (sql.startsWith('SELECT * FROM orders WHERE idempotency_key')) return null;
      if (sql.startsWith('SELECT id, name, format, price_paise, active FROM products'))
        return ROWS.filter((r) => args.includes(r.id));
      if (sql.trim().startsWith('INSERT INTO orders')) inserted.push(sql);
      return null;
    });
    return { DB: rateLimited(db), TURNSTILE_SECRET_KEY: 'test' } as Env;
  };
  const post = (body: unknown, e: Env) =>
    app.request(
      '/api/orders',
      {
        method: 'POST',
        body: JSON.stringify(body),
        headers: { 'Content-Type': 'application/json' },
      },
      e,
    );
  const turnstile = (success: boolean) =>
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ success }))),
    );

  it('refuses a tampered total (the server prices from the database)', async () => {
    turnstile(true);
    const inserted: string[] = [];
    const res = await post({ ...good(), expectedTotalPaise: 100 }, env(inserted));
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ error: 'prices_changed', totalPaise: 44700 });
    expect(inserted).toHaveLength(0);
  });

  it('ignores prices sent by the client', async () => {
    turnstile(true);
    const inserted: string[] = [];
    const items = [{ id: 'herbal-black-salt-1kg', qty: 2, price: 1, unitPricePaise: 1 }];
    const res = await post({ ...good(), items, expectedTotalPaise: 2 }, env(inserted));
    expect(res.status).toBe(409);
    expect(inserted).toHaveLength(0);
  });

  it('refuses cash on delivery above ₹2,000', async () => {
    turnstile(true);
    const items = [{ id: 'herbal-black-salt-1kg', qty: 11 }];
    const res = await post({ ...good(), items, expectedTotalPaise: 218900 }, env());
    expect(res.status).toBe(400);
    expect(((await res.json()) as { fields: Record<string, string> }).fields.payment).toMatch(
      /2,000/,
    );
  });

  it('refuses a failed Turnstile check', async () => {
    turnstile(false);
    expect((await post(good(), env())).status).toBe(403);
  });

  it('refuses an unavailable product', async () => {
    turnstile(true);
    const res = await post({ ...good(), items: [{ id: 'the-sambhar-pair', qty: 1 }] }, env());
    expect(res.status).toBe(409);
  });

  it('refuses a body over 16 KB and answers 429 over the rate limit', async () => {
    const big = await app.request(
      '/api/orders',
      {
        method: 'POST',
        body: 'x'.repeat(17 * 1024),
        headers: { 'Content-Type': 'application/json' },
      },
      env(),
    );
    expect(big.status).toBe(413);
    const e = env();
    const limited = await post(good(), { ...e, DB: rateLimited(e.DB, 999) });
    expect(limited.status).toBe(429);
  });
});
