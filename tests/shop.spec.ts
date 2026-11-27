import { expect, test } from '@playwright/test';

/** The shop (/shop), its filters in the URL, the product pages, and the old /product URLs. */
test.describe('shop', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      try {
        if (!sessionStorage.getItem('pw:shop')) {
          localStorage.clear();
          sessionStorage.setItem('pw:shop', '1');
        }
      } catch {}
    });
  });

  test('/shop loads with the three salts and the promise row', async ({ page }) => {
    await page.goto('/shop');
    await expect(page.getByRole('heading', { level: 1, name: 'The Salts.' })).toBeVisible();
    await expect(page.locator('[data-card]:visible')).toHaveCount(3);
    for (const name of ['Herbal Black Salt', 'Natural Lake Salt', 'Pink Rock Salt'])
      await expect(page.getByRole('heading', { level: 2, name })).toBeVisible();
    await expect(page.getByRole('link', { name: /Cook with them/ })).toHaveAttribute(
      'href',
      '/recipes',
    );
    expect(await page.locator('canvas').count()).toBe(0); // no WebGL on this page
  });

  test('filters: from the URL, and chips update it without a reload', async ({ page }) => {
    await page.goto('/shop?salt=pink');
    await expect(page.locator('[data-card]:visible')).toHaveCount(1);
    await expect(page.locator('[data-card="pink"]')).toBeVisible();
    await expect(
      page.locator('nav').getByRole('button', { name: 'Pink Rock Salt', exact: true }),
    ).toHaveAttribute('aria-pressed', 'true');

    await page.evaluate(() => ((window as unknown as { __mark: number }).__mark = 1));
    await page
      .locator('nav')
      .getByRole('button', { name: 'Herbal Black Salt', exact: true })
      .click();
    await expect(page).toHaveURL(/\?salt=black$/);
    await expect(page.locator('[data-card]:visible')).toHaveCount(1);
    await page.locator('nav').getByRole('button', { name: 'Pouches', exact: true }).click();
    await expect(page).toHaveURL(/salt=black&format=pouch/);
    // the card shows its pouch under the format filter
    const card = page.locator('[data-card="black"]');
    await expect(card.getByRole('radio', { name: 'Pouch' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await expect(card.getByText('₹149')).toBeVisible();
    await page.locator('nav').getByRole('button', { name: 'All', exact: true }).click();
    await expect(page).toHaveURL(/\/shop$/);
    await expect(page.locator('[data-card]:visible')).toHaveCount(3);
    // no reload happened
    expect(await page.evaluate(() => (window as unknown as { __mark?: number }).__mark)).toBe(1);
    await page.goBack();
    await expect(page).toHaveURL(/format=pouch/);
  });

  test('Add to bag from a card; Jar · Pouch switches the price', async ({ page }) => {
    await page.goto('/shop');
    const card = page.locator('[data-card="lake"]');
    await expect(card.getByText('₹199')).toBeVisible();
    await card.getByRole('radio', { name: 'Pouch' }).click();
    await expect(card.getByText('₹149')).toBeVisible();
    await card.getByRole('button', { name: /Add to bag/ }).click();
    await expect(page.locator('[data-bag-target]')).toContainText('1');
    // the name links to the product page
    await expect(card.getByRole('link', { name: 'Natural Lake Salt' })).toHaveAttribute(
      'href',
      '/shop/natural-lake-salt',
    );
  });

  test('product page: details, Jar/Pouch, add, JSON-LD and breadcrumbs', async ({ page }) => {
    await page.goto('/shop/herbal-black-salt');
    await expect(page.getByRole('heading', { level: 1, name: 'Herbal Black Salt' })).toBeVisible();
    const price = page.locator('[data-price]');
    await expect(price).toContainText('₹199');
    await page
      .getByRole('radiogroup', { name: 'Format, Herbal Black Salt' })
      .getByRole('radio', { name: /Pouch/ })
      .click();
    await expect(price).toContainText('₹149');
    await expect(price).toContainText('1 kg pouch');
    await page.getByRole('button', { name: 'Increase quantity' }).click();
    await page
      .locator('main')
      .getByRole('button', { name: /^Add to bag/ })
      .first()
      .click();
    await expect(page.locator('[data-bag-target]')).toContainText('2');
    for (const h of [
      'About this salt',
      'How to use it',
      'Ingredients & label',
      'Recipes with this salt',
      'The other salts',
    ])
      await expect(page.getByRole('heading', { level: 2, name: h })).toBeVisible();
    await expect(page.getByText('Batch and dates printed on the pack')).toBeVisible();
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      /\/shop\/herbal-black-salt$/,
    );
    const ld = await page
      .locator('script[type="application/ld+json"]')
      .evaluateAll((els) => els.map((e) => JSON.parse(e.textContent ?? '{}')));
    const prod = ld.find((d) => d['@type'] === 'Product');
    expect(prod.offers).toHaveLength(2);
    expect(prod.url).toMatch(/\/shop\/herbal-black-salt$/);
    const crumbs = ld.find((d) => d['@type'] === 'BreadcrumbList');
    expect(crumbs.itemListElement.map((i: { name: string }) => i.name)).toEqual([
      'Home',
      'Shop',
      'Herbal Black Salt',
    ]);
    // the label reader opens (flat) and closes
    await page.getByRole('button', { name: /Read the label/ }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toBeHidden();
  });

  test('old /product URLs redirect permanently to /shop', async ({ page, request }) => {
    for (const h of ['herbal-black-salt', 'natural-lake-salt', 'pink-rock-salt']) {
      const res = await request.get(`/product/${h}`, { maxRedirects: 0 });
      expect(res.status()).toBe(301);
      expect(res.headers().location).toMatch(new RegExp(`/shop/${h}$`));
    }
    await page.goto('/product/pink-rock-salt');
    await expect(page).toHaveURL(/\/shop\/pink-rock-salt$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Pink Rock Salt' })).toBeVisible();
  });

  test('every Shop link points at /shop', async ({ page }) => {
    await page.goto('/our-roots');
    await expect(page.locator('footer a[href="/shop/herbal-black-salt"]')).toHaveCount(1);
    await expect(page.locator('[data-shop-strip] a[href="/shop/natural-lake-salt"]')).toHaveCount(
      1,
    );
    const res = await page.goto('/no-such-page');
    expect(res?.status()).toBe(404);
    await expect(page.locator('main a[href="/shop"]')).toHaveCount(1);
  });
});
