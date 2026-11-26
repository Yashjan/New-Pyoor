/** WebCrypto helpers (Workers and Node 20 both have crypto.subtle). */

const enc = new TextEncoder();

const hex = (buf: ArrayBuffer) =>
  [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

/** HMAC-SHA256 of `message` with `secret`, as lowercase hex. */
export async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return hex(await crypto.subtle.sign('HMAC', key, enc.encode(message)));
}

/** Compares two strings in time independent of where they differ. */
export function safeEqual(a: string, b: string): boolean {
  const x = enc.encode(a);
  const y = enc.encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

/** Razorpay's payment signature: HMAC-SHA256(order_id + "|" + payment_id, key secret). */
export async function verifyPaymentSignature(
  keySecret: string,
  orderId: string,
  paymentId: string,
  signature: string,
): Promise<boolean> {
  if (!keySecret || !orderId || !paymentId || !/^[0-9a-f]{64}$/.test(signature)) return false;
  return safeEqual(await hmacSha256Hex(keySecret, `${orderId}|${paymentId}`), signature);
}

/** Razorpay's webhook signature: HMAC-SHA256(raw body, webhook secret). */
export async function verifyWebhookSignature(
  webhookSecret: string,
  rawBody: string,
  signature: string,
): Promise<boolean> {
  if (!webhookSecret || !/^[0-9a-f]{64}$/.test(signature)) return false;
  return safeEqual(await hmacSha256Hex(webhookSecret, rawBody), signature);
}

/** A random URL-safe token (the customer's access token for their order). */
export function randomToken(bytes = 24): string {
  const b = crypto.getRandomValues(new Uint8Array(bytes));
  return btoa(String.fromCharCode(...b))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// no 0/O, 1/I/L, U: easy to read out on the phone
const REF_CHARS = '23456789ABCDEFGHJKMNPQRSTVWXYZ';

/** An order's public reference, e.g. "PY-24A7K". */
export function publicRef(): string {
  const b = crypto.getRandomValues(new Uint8Array(5));
  return 'PY-' + [...b].map((x) => REF_CHARS[x % REF_CHARS.length]).join('');
}
