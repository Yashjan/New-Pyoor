import { test, expect } from '@playwright/test';

/** The story pages and the recipes index: load, navigation, the shop strip, the filter. */

for (const [path, h1, chapters] of [
  ['/our-roots', 'Born on the shores of Sambhar.', 7],
  ['/the-journey', 'From the lake to your kitchen.', 9],
] as const) {
  test(`${path} loads: title, chapters, canonical, OG image, sitemap`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const res = await page.goto(path);
    expect(res?.status()).toBe(200);
    await expect(page.locator('h1')).toHaveText(h1);
    await expect(page.locator('main > ol > li[id]')).toHaveCount(chapters);
    expect(await page.locator('link[rel="canonical"]').getAttribute('href')).toMatch(
      new RegExp(`${path}$`),
    );
    const og = await page.locator('meta[property="og:image"]').getAttribute('content');
    expect(og).toBeTruthy();
    expect((await page.request.get(new URL(og!).pathname)).status()).toBe(200);
    // an engraving draws itself once it is in view
    const art = page.locator('main [data-engr]').first();
    await art.scrollIntoViewIfNeeded();
    await expect(art).toHaveAttribute('data-drawn', '', { timeout: 8000 });
    const sitemap = await (await page.request.get('/sitemap.xml')).text();
    expect(sitemap).toContain(path);
    // nothing on the pages says Pyoor gets its salt from someone else
    const text = (await page.locator('main').innerText()).toLowerCase();
    expect(text).not.toMatch(/supplier|sourc(e|ed|ing)\b|partner|procure|buy from/);
    expect(errors).toEqual([]);
  });

  test(`${path}: Add to bag on the shop strip`, async ({ page }) => {
    await page.goto(path);
    const strip = page.locator('[data-shop-strip]');
    await strip.scrollIntoViewIfNeeded();
    const row = strip.locator('[data-salt="natural-lake-salt"]');
    await row.getByRole('button', { name: /Add to bag/ }).click();
    await expect(page.locator('[data-bag-target]')).toContainText(/1/);
    await strip
      .locator('[data-salt="herbal-black-salt"]')
      .getByRole('button', { name: /Add to bag/ })
      .click();
    await expect(page.locator('[data-bag-target]')).toContainText(/2/);
  });
}

test('nav: the menu and footer link to /our-roots, /the-journey and /recipes', async ({ page }) => {
  await page.goto('/recipes');
  for (const [label, path] of [
    ['Our roots', '/our-roots'],
    ['The journey', '/the-journey'],
    ['Recipes', '/recipes'],
  ] as const) {
    await page.locator('button[aria-expanded]').first().click();
    const link = page.locator(`[role="dialog"] a[data-link][href="${path}"]`);
    await expect(link).toBeVisible();
    await link.click();
    await expect(page).toHaveURL(new RegExp(`${path}$`));
    await expect(page.locator('h1')).toBeVisible();
    // the footer has it too
    await expect(
      page.locator('footer').getByRole('link', { name: label, exact: true }),
    ).toHaveAttribute('href', path);
  }
  // the homepage's quiet links
  await page.goto('/');
  await expect(page.locator('a[href="/the-journey"][data-journey-more]')).toHaveCount(1);
  await expect(page.locator('[data-write] a[href="/our-roots"]')).toHaveCount(1);
});

test('/recipes: six cards, the salt chips filter them', async ({ page }) => {
  await page.goto('/recipes');
  await expect(page.locator('h1')).toHaveText('Simple things, made with salt.');
  const cards = page.locator('main li[data-salts]');
  await expect(cards).toHaveCount(6);
  const visible = () => cards.evaluateAll((els) => els.filter((e) => e.checkVisibility()).length);
  expect(await visible()).toBe(6);
  await page.getByRole('button', { name: 'Natural Lake Salt' }).click();
  await expect(page.getByRole('button', { name: 'Natural Lake Salt' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  expect(await visible()).toBe(2);
  await page.getByRole('button', { name: 'Herbal Black Salt' }).click();
  expect(await visible()).toBe(5);
  await page.getByRole('button', { name: 'All' }).click();
  expect(await visible()).toBe(6);
  for (const slug of ['jaljeera', 'aloo-chaat', 'kachumber-salad']) {
    expect((await page.request.get(`/recipes/${slug}`)).status()).toBe(200);
  }
});
