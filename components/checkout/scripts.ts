/** Loads a third-party script once (Turnstile, Razorpay Checkout), on demand. */
const loading = new Map<string, Promise<void>>();

export function loadScript(src: string): Promise<void> {
  let p = loading.get(src);
  if (!p) {
    p = new Promise<void>((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => {
        loading.delete(src);
        reject(new Error(`could not load ${src}`));
      };
      document.head.appendChild(s);
    });
    loading.set(src, p);
  }
  return p;
}

type TurnstileApi = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  execute: (id: string) => void;
  reset: (id: string) => void;
};

/** Cloudflare Turnstile's site key: the official always-passing invisible test key until set. */
export const TURNSTILE_SITE_KEY =
  process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || '1x00000000000000000000BB';

let widget: string | null = null;
let pending: { resolve: (t: string) => void; reject: (e: Error) => void } | null = null;

/** A fresh Turnstile token (invisible; a challenge shows only if Cloudflare needs one). */
export async function turnstileToken(el: HTMLElement): Promise<string> {
  await loadScript('https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit');
  const ts = (window as unknown as { turnstile: TurnstileApi }).turnstile;
  return new Promise<string>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error('turnstile timeout')), 30_000);
    pending = {
      resolve: (t) => (window.clearTimeout(timer), resolve(t)),
      reject: (e) => (window.clearTimeout(timer), reject(e)),
    };
    if (widget == null || !el.isConnected) {
      widget = ts.render(el, {
        sitekey: TURNSTILE_SITE_KEY,
        execution: 'execute',
        appearance: 'interaction-only',
        callback: (t: string) => pending?.resolve(t),
        'error-callback': () => pending?.reject(new Error('turnstile error')),
      });
    } else ts.reset(widget);
    ts.execute(widget);
  });
}

export type RazorpayResponse = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

type RazorpayCtor = new (opts: Record<string, unknown>) => {
  open: () => void;
  on: (event: string, cb: (r: unknown) => void) => void;
};

/** Opens Razorpay Standard Checkout; resolves with the payment, or null if it was closed. */
/** The checkout's header logo: an absolute https URL in production; Razorpay won't load an http
 *  (local) URL, so there the same PNG goes inline as a data URL. */
async function logoUrl(): Promise<string> {
  const url = `${window.location.origin}/brand/razorpay-logo.png`;
  if (window.location.protocol === 'https:') return url;
  try {
    const blob = await (await fetch(url)).blob();
    return await new Promise<string>((ok, no) => {
      const r = new FileReader();
      r.onload = () => ok(String(r.result));
      r.onerror = no;
      r.readAsDataURL(blob);
    });
  } catch {
    return url;
  }
}

export async function razorpayPay(opts: {
  keyId: string;
  orderId: string;
  amount: number;
  ref: string;
  prefill: { name: string; contact: string; email?: string };
}): Promise<RazorpayResponse | 'failed' | null> {
  await loadScript('https://checkout.razorpay.com/v1/checkout.js');
  const Razorpay = (window as unknown as { Razorpay: RazorpayCtor }).Razorpay;
  const image = await logoUrl();
  return new Promise((resolve) => {
    let failed = false;
    const rzp = new Razorpay({
      key: opts.keyId,
      order_id: opts.orderId,
      amount: opts.amount,
      currency: 'INR',
      name: 'Pyoor',
      image,
      description: `Order ${opts.ref}`,
      prefill: opts.prefill,
      theme: { color: '#18214a' },
      handler: (r: RazorpayResponse) => resolve(r),
      modal: { ondismiss: () => resolve(failed ? 'failed' : null), escape: true },
    });
    rzp.on('payment.failed', () => {
      failed = true;
    });
    rzp.open();
  });
}
