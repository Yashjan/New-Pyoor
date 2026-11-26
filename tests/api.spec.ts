import { expect, test } from '@playwright/test';

/**
 * The API on the real local runtime (npm run dev:cf, then PW_BASE_URL=http://localhost:8788).
 * Skipped where the target has no Functions (the static server answers /api/* with 501).
 */
test.describe('api', () => {
  test.beforeEach(async ({ request }, info) => {
    test.skip(info.project.name !== 'desktop', 'runs once');
    const res = await request.get('/api/health');
    test.skip(res.status() === 501, 'no Functions on this target');
  });

  test('GET /api/health: ok, with the database', async ({ request }) => {
    const res = await request.get('/api/health');
    expect(res.status()).toBe(200);
    expect(await res.json()).toEqual({ ok: true, db: true });
  });

  test('GET /api/products: the seeded prices from D1', async ({ request }) => {
    const res = await request.get('/api/products');
    expect(res.status()).toBe(200);
    const { products } = (await res.json()) as {
      products: { id: string; format: string; price_paise: number }[];
    };
    expect(products.length).toBeGreaterThan(0);
    expect(products.find((p) => p.id === 'herbal-black-salt-1kg')?.price_paise).toBe(19900);
    const pouches = await (await request.get('/api/products?format=pouch')).json();
    expect(pouches.products.every((p: { format: string }) => p.format === 'pouch')).toBe(true);
    expect((await request.get('/api/products?format=box')).status()).toBe(400);
  });
});
