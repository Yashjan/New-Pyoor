import type { D1Database } from '@cloudflare/workers-types';

export type RazorpayEvent = {
  event?: string;
  payload?: {
    payment?: {
      entity?: {
        id?: string;
        order_id?: string;
        amount?: number;
        error_description?: string;
      };
    };
  };
};

/**
 * Applies a verified Razorpay webhook. Idempotent: each event is recorded once (events.source_id
 * is unique), so a redelivery changes nothing. payment.captured marks a pending order paid (the
 * source of truth when the browser closed before /api/payments/verify); payment.failed is only
 * logged, the order stays pending so the customer can retry.
 */
export async function processWebhook(
  db: D1Database,
  ev: RazorpayEvent,
  eventId: string,
): Promise<'applied' | 'duplicate' | 'ignored'> {
  const type = ev.event ?? '';
  const p = ev.payload?.payment?.entity;
  if ((type !== 'payment.captured' && type !== 'payment.failed') || !p?.order_id || !p.id)
    return 'ignored';

  const order = await db
    .prepare('SELECT id, status, total_paise FROM orders WHERE razorpay_order_id = ?')
    .bind(p.order_id)
    .first<{ id: number; status: string; total_paise: number }>();
  if (!order) return 'ignored';

  const mismatch = type === 'payment.captured' && p.amount !== order.total_paise;
  const logged = await db
    .prepare(
      'INSERT OR IGNORE INTO events (order_id, type, payload, source_id) VALUES (?, ?, ?, ?)',
    )
    .bind(
      order.id,
      mismatch ? 'payment.amount_mismatch' : type,
      JSON.stringify({
        payment_id: p.id,
        amount: p.amount ?? null,
        ...(p.error_description ? { error: p.error_description.slice(0, 200) } : {}),
      }),
      eventId,
    )
    .run();
  if (!logged.meta.changes) return 'duplicate';

  if (type === 'payment.captured' && !mismatch)
    await db
      .prepare(
        "UPDATE orders SET status = 'paid', razorpay_payment_id = ?, " +
          "updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ? AND status = 'pending'",
      )
      .bind(p.id, order.id)
      .run();
  return 'applied';
}
