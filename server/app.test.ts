import { readFileSync } from 'node:fs';
import type { D1Database } from '@cloudflare/workers-types';
import { describe, expect, it } from 'vitest';
import { app, type Env } from './app';
import { seedRows, seedSql } from './seed';
import { PRICES_INR } from '../lib/commerce/pricing';

type Row = ReturnType<typeof seedRows>[number];

/** A stand-in for D1: answers the two queries the API makes, from the seed rows. */
function fakeDb(rows: Row[], opts: { fail?: boolean } = {}) {
  const calls: { sql: string; args: unknown[] }[] = [];
  const stmt = (sql: string, args: unknown[] = []) => ({
    bind: (...a: unknown[]) => stmt(sql, a),
    first: async () => {
      calls.push({ sql, args });
      if (opts.fail) throw new Error('D1 down');
      return { ok: 1 };
    },
    all: async () => {
      calls.push({ sql, args });
      if (opts.fail) throw new Error('D1 down');
      const results = rows
        .filter((r) => r.active === 1 && (args.length === 0 || r.format === args[0]))
        .map(({ id, slug, name, format, price_paise }) => ({
          id,
          slug,
          name,
          format,
          price_paise,
        }));
      return { results, success: true, meta: {} };
    },
  });
  return { db: { prepare: (sql: string) => stmt(sql) } as unknown as D1Database, calls };
}

const req = (path: string, env: Partial<Env>) => app.request(path, {}, env as Env);

describe('GET /api/health', () => {
  it('reports ok and the database', async () => {
    const res = await req('/api/health', { DB: fakeDb(seedRows()).db });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, db: true });
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  it('reports db:false with 503 when D1 fails', async () => {
    const res = await req('/api/health', { DB: fakeDb([], { fail: true }).db });
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ ok: true, db: false });
  });
});

describe('GET /api/products', () => {
  it('lists the active products with prices in paise', async () => {
    const res = await req('/api/products', { DB: fakeDb(seedRows()).db });
    expect(res.status).toBe(200);
    const { products } = (await res.json()) as { products: Row[] };
    expect(products.length).toBeGreaterThan(0);
    const jar = products.find((p) => p.id === 'herbal-black-salt-1kg');
    expect(jar).toMatchObject({ slug: 'herbal-black-salt', format: 'jar' });
    expect(jar!.price_paise).toBe(PRICES_INR['local:variant:herbal-black-salt-1kg']! * 100);
    // unpriced products are not listed
    expect(products.every((p) => p.price_paise != null)).toBe(true);
  });

  it('filters by format, bound as a parameter', async () => {
    const { db, calls } = fakeDb(seedRows());
    const res = await req('/api/products?format=pouch', { DB: db });
    const { products } = (await res.json()) as { products: Row[] };
    expect(products.length).toBeGreaterThan(0);
    expect(products.every((p) => p.format === 'pouch')).toBe(true);
    expect(calls[0]!.args).toEqual(['pouch']);
  });

  it('rejects an unknown format', async () => {
    const res = await req('/api/products?format=box', { DB: fakeDb(seedRows()).db });
    expect(res.status).toBe(400);
  });

  it('answers 500 without details when D1 fails', async () => {
    const res = await req('/api/products', { DB: fakeDb([], { fail: true }).db });
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'server error' });
  });
});

describe('API', () => {
  it('answers JSON 404 for unknown routes', async () => {
    const res = await req('/api/nope', { DB: fakeDb([]).db });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'not found' });
  });
});

describe('seed', () => {
  it('db/seed.sql is generated from pricing.ts (run npm run db:seed:gen)', () => {
    expect(readFileSync('db/seed.sql', 'utf8')).toBe(seedSql());
  });

  it('covers every priced variant in pricing.ts', () => {
    const rows = seedRows();
    for (const [id, inr] of Object.entries(PRICES_INR)) {
      const row = rows.find((r) => r.id === id.replace(/^local:variant:/, ''));
      expect(row, id).toBeDefined();
      expect(row!.price_paise).toBe(inr == null ? null : inr * 100);
    }
  });
});
