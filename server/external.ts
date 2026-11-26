/** The two outside services: Cloudflare Turnstile and the Razorpay Orders API (plain fetch). */

/** Turnstile's official test secret (always passes): local development only, never production. */
export const TURNSTILE_TEST_SECRET = '1x0000000000000000000000000000000AA';

export async function verifyTurnstile(
  secret: string,
  token: string,
  ip: string | null,
  fetcher: typeof fetch = fetch,
): Promise<boolean> {
  const form = new FormData();
  form.append('secret', secret);
  form.append('response', token);
  if (ip) form.append('remoteip', ip);
  try {
    const res = await fetcher('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: form,
    });
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch {
    return false;
  }
}

/** Creates a Razorpay Order (amount in paise); returns its id, or null if Razorpay refused. */
export async function createRazorpayOrder(
  keyId: string,
  keySecret: string,
  amountPaise: number,
  receipt: string,
  fetcher: typeof fetch = fetch,
): Promise<string | null> {
  try {
    const res = await fetcher('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${btoa(`${keyId}:${keySecret}`)}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: amountPaise,
        currency: 'INR',
        receipt,
        notes: { ref: receipt },
      }),
    });
    if (!res.ok) {
      // the status only: Razorpay's error body can echo request details
      console.error('razorpay orders api:', res.status);
      return null;
    }
    const data = (await res.json()) as { id?: string };
    return typeof data.id === 'string' ? data.id : null;
  } catch {
    console.error('razorpay orders api: unreachable');
    return null;
  }
}
