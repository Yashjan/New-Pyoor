import type { D1Database } from '@cloudflare/workers-types';
import { Hono } from 'hono';
import { validator } from 'hono/validator';

/** The Pages Functions' bindings (wrangler.toml) and secrets (.dev.vars / the dashboard). */
export type Env = {
  DB: D1Database;
  RAZORPAY_KEY_ID?: string;
  RAZORPAY_KEY_SECRET?: string;
  RAZORPAY_WEBHOOK_SECRET?: string;
  ADMIN_EMAIL?: string;
};

export type ProductRow = {
  id: string;
  slug: string;
  name: string;
  format: 'jar' | 'pouch';
  price_paise: number | null;
};

const FORMATS = ['jar', 'pouch'] as const;

/**
 * The API (/api/*). Kept light: the free plan gives a request 10 ms of CPU (waiting on D1
 * doesn't count), so plain SQL, no ORM, no rendering.
 */
export const app = new Hono<{ Bindings: Env }>().basePath('/api');

app.use('*', async (c, next) => {
  await next();
  c.header('Cache-Control', 'no-store');
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

app.notFound((c) => c.json({ error: 'not found' }, 404));
app.onError((err, c) => {
  // the message only: never the request, its headers or any secret
  console.error('api error:', err.message);
  return c.json({ error: 'server error' }, 500);
});
