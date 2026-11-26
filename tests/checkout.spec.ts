import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

/**
 * The checkout against the real local runtime (npm run dev:cf; PW_BASE_URL=http://localhost:8788):
 * COD end to end, online up to Razorpay (its checkout mocked, the signature made here with the
 * test key secret), the confirmation, the admin and a tampered price. Secrets are read from
 * .dev.vars and never printed. Skipped where the target has no Functions.
 */
const vars = (() => {
  try {
    return Object.fromEntries(
      readFileSync('.dev.vars', 'utf8')
        .split('\n')
        .map((l) => l.match(/^([A-Z_]+)=(.*)$/))
        .filter((m): m is RegExpMatchArray => !!m)
        .map((m) => [m[1], m[2]!.trim()]),
    ) as Record<string, string>;
  } catch {
    return {} as Record<string, string>;
  }
})();

const CART = {
  id: 'local-cart',
  lines: [
    {
      id: 'line:local:variant:herbal-black-salt-1kg',
      variantId: 'local:variant:herbal-black-salt-1kg',
      quantity: 2,
    },
  ],
};

test.describe('checkout', () => {
  test.describe.configure({ mode: 'serial' });
  let codRef = '';

  test.beforeEach(async ({ request }, info) => {
    test.skip(info.project.name !== 'desktop', 'runs once');
    const res = await request.get('/api/health');
    test.skip(res.status() === 501, 'no Functions on this target');
  });

  async function openCheckout(page: Page) {
    await page.goto('/terms');
    await page.evaluate((c) => {
      localStorage.setItem('pyoor:cart:v1', JSON.stringify(c));
      localStorage.removeItem('pyoor:checkout:draft:v1');
      localStorage.removeItem('pyoor:checkout:saved:v1');
    }, CART);
    await page.goto('/checkout');
    await expect(page.locator('[data-total]')).toHaveText('₹447');
  }

  async function fill(page: Page) {
    await page.getByLabel('Full name').fill('Asha Verma');
    await page.getByLabel('Mobile number').fill('98765 43210');
    await page.getByLabel('House / flat').fill('12, Rose Villa');
    await page.getByLabel('Street / area').fill('MG Road');
    await page.getByLabel('Pincode').fill('302001');
    await page.getByLabel('City').fill('Jaipur');
    await page.getByLabel('State').selectOption('Rajasthan');
  }

  test('inline errors, and the form keeps its values on reload', async ({ page }) => {
    await openCheckout(page);
    await page.getByRole('button', { name: /Pay ₹447 securely/ }).click();
    await expect(page.getByText('Please enter your name.')).toBeVisible();
    await expect(page.getByText('Enter a 6-digit pincode.')).toBeVisible();
    await expect(page.getByLabel('Full name')).toBeFocused();
    await page.getByLabel('Full name').fill('Asha Verma');
    await page.getByLabel('Pincode').fill('302001');
    await page.reload();
    await expect(page.getByLabel('Full name')).toHaveValue('Asha Verma');
    await expect(page.getByLabel('Pincode')).toHaveValue('302001');
  });

  test('cash on delivery: order placed, confirmation shown, bag cleared', async ({ page }) => {
    await openCheckout(page);
    await fill(page);
    await page.getByLabel('Cash on delivery').check();
    await page.getByRole('button', { name: 'Place order · Cash on delivery' }).click();
    await page.waitForURL(/\/order\?ref=PY-/, { timeout: 30_000 });
    await expect(page.getByRole('heading', { name: 'Thank you.' })).toBeVisible();
    codRef = (await page.locator('[data-ref]').textContent()) ?? '';
    expect(codRef).toMatch(/^PY-[A-Z0-9]{5}$/);
    await expect(page.locator('[data-total]')).toHaveText('₹447');
    await expect(page.locator('[data-payment]')).toContainText('Cash on delivery');
    await expect(page.getByText('Herbal Black Salt, 1 kg jar × 2')).toBeVisible();
    await expect(page.getByText('MG Road')).toBeVisible();
    await expect(page.getByText(/tracking details on WhatsApp/)).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(
          () => JSON.parse(localStorage.getItem('pyoor:cart:v1') ?? '{}').lines?.length,
        ),
      )
      .toBe(0);
    // the confirmation needs the order's token
    const url = new URL(page.url());
    const wrong = await page.request.get(`/api/orders/${codRef}?token=wrong-token`);
    expect(wrong.status()).toBe(404);
    expect(
      (await page.request.get(`/api/orders/${codRef}?token=${url.searchParams.get('token')}`)).ok(),
    ).toBe(true);
  });

  test('online: Razorpay opens with the order; a valid signature marks it paid', async ({
    page,
  }) => {
    test.skip(!vars.RAZORPAY_KEY_SECRET, 'RAZORPAY_KEY_SECRET not set in .dev.vars');
    // Razorpay's checkout, mocked: open() hands its options to the test
    await page.route('https://checkout.razorpay.com/v1/checkout.js', (route) =>
      route.fulfill({
        contentType: 'text/javascript',
        body: `window.Razorpay=function(o){this.o=o};Razorpay.prototype.on=function(){};Razorpay.prototype.open=function(){window.__rzp=this.o};`,
      }),
    );
    await openCheckout(page);
    await fill(page);
    await page.getByRole('button', { name: 'Pay ₹447 securely' }).click();
    const handle = await page.waitForFunction(
      () => (window as unknown as { __rzp?: unknown }).__rzp,
      null,
      {
        timeout: 30_000,
      },
    );
    const opts = (await handle.jsonValue()) as {
      order_id: string;
      amount: number;
      key: string;
      name: string;
      theme: { color: string };
      prefill: { name: string; contact: string };
    };
    expect(opts.order_id).toMatch(/^order_/);
    expect(opts.amount).toBe(44700);
    expect(opts.key).toMatch(/^rzp_test_/);
    expect(opts).toMatchObject({ name: 'Pyoor', theme: { color: '#18214a' } });
    expect(opts.prefill).toMatchObject({ name: 'Asha Verma', contact: '+919876543210' });

    const payment = 'pay_TEST' + Date.now();
    const signature = createHmac('sha256', vars.RAZORPAY_KEY_SECRET!)
      .update(`${opts.order_id}|${payment}`)
      .digest('hex');
    await page.evaluate(
      (r) => (window as unknown as { __rzp: { handler: (x: unknown) => void } }).__rzp.handler(r),
      {
        razorpay_order_id: opts.order_id,
        razorpay_payment_id: payment,
        razorpay_signature: signature,
      },
    );
    await page.waitForURL(/\/order\?ref=PY-/, { timeout: 30_000 });
    await expect(page.locator('[data-payment]')).toHaveText('Paid online.');
  });

  test('a forged payment signature is refused', async ({ request }) => {
    const res = await request.post('/api/payments/verify', {
      data: {
        ref: 'PY-AAAAA',
        token: 'x',
        razorpay_order_id: 'order_x',
        razorpay_payment_id: 'pay_x',
        razorpay_signature: 'a'.repeat(64),
      },
    });
    expect(res.status()).toBe(404);
  });

  test('a tampered price is rejected', async ({ request }) => {
    const res = await request.post('/api/orders', {
      data: {
        idempotencyKey: `tamper-${Date.now()}-abcdef`,
        items: [{ id: 'herbal-black-salt-1kg', qty: 2, price: 1 }],
        contact: { name: 'Asha Verma', phone: '9876543210', email: '' },
        address: {
          line1: '12, Rose Villa',
          line2: 'MG Road',
          landmark: '',
          pincode: '302001',
          city: 'Jaipur',
          state: 'Rajasthan',
        },
        payment: 'cod',
        expectedTotalPaise: 200,
        turnstileToken: 'XXXX.DUMMY.TOKEN.XXXX',
      },
    });
    expect(res.status()).toBe(409);
    expect(await res.json()).toMatchObject({ error: 'prices_changed', totalPaise: 44700 });
  });

  test('admin: sign in, open the order, mark it packed, then shipped', async ({ page }) => {
    test.skip(!vars.ADMIN_TOKEN || !codRef, 'ADMIN_TOKEN not set, or no COD order');
    await page.goto('/admin');
    await page.getByLabel('Admin token').fill('wrong-token');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByText('That token wasn’t accepted.')).toBeVisible();
    await page.getByLabel('Admin token').fill(vars.ADMIN_TOKEN!);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.getByRole('button', { name: codRef, exact: true }).click();
    const status = page.locator('[data-detail-status]');
    await expect(status).toHaveText('COD confirmed');
    await page.getByRole('button', { name: 'Mark packed' }).click();
    await expect(status).toHaveText('Packed');
    await page.getByRole('button', { name: 'Mark shipped' }).click();
    await expect(page.getByText('Add the tracking number first.')).toBeVisible();
    await page.getByLabel('Tracking number').fill('SR123456789');
    await page.getByRole('button', { name: 'Mark shipped' }).click();
    await expect(status).toHaveText('Shipped');
    await expect(page.getByText('Tracking: SR123456789')).toBeVisible();
    await expect(page.getByText('status.shipped')).toBeVisible();
    // the CSV has the order
    const csv = await page.request.get('/api/admin/orders.csv', {
      headers: { Authorization: `Bearer ${vars.ADMIN_TOKEN}` },
    });
    expect(await csv.text()).toContain(codRef);
  });
});
