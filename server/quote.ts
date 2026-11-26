import { codAllowed, shippingPaise } from '../lib/commerce/pricing';
import type { OrderRequest } from '../lib/checkout';

export type PriceRow = {
  id: string;
  name: string;
  format: 'jar' | 'pouch';
  price_paise: number | null;
  active: number;
};

export type Quote = {
  lines: { id: string; name: string; format: 'jar' | 'pouch'; qty: number; unitPaise: number }[];
  subtotalPaise: number;
  shippingPaise: number;
  totalPaise: number;
  codAllowed: boolean;
};

/**
 * Prices an order from the database's rows only (never the client's): every item must be an
 * active, priced product. Returns the ids it can't sell, if any.
 */
export function quote(
  items: OrderRequest['items'],
  rows: PriceRow[],
): { ok: true; quote: Quote } | { ok: false; unavailable: string[] } {
  const byId = new Map(rows.map((r) => [r.id, r]));
  const unavailable: string[] = [];
  const lines: Quote['lines'] = [];
  for (const it of items) {
    const r = byId.get(it.id);
    if (!r || r.active !== 1 || r.price_paise == null || r.price_paise <= 0) {
      unavailable.push(it.id);
      continue;
    }
    lines.push({ id: r.id, name: r.name, format: r.format, qty: it.qty, unitPaise: r.price_paise });
  }
  if (unavailable.length) return { ok: false, unavailable };
  const subtotalPaise = lines.reduce((s, l) => s + l.unitPaise * l.qty, 0);
  const ship = shippingPaise(subtotalPaise);
  const totalPaise = subtotalPaise + ship;
  return {
    ok: true,
    quote: {
      lines,
      subtotalPaise,
      shippingPaise: ship,
      totalPaise,
      codAllowed: codAllowed(totalPaise),
    },
  };
}
