import type { Money } from '@/lib/commerce';

const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
});

export const PRICE_COMING_SOON = 'Price coming soon';

/** "₹249", or "Price coming soon" while a price is not set. */
export function formatPrice(money: Money | null): string {
  return money ? inr.format(money.amount) : PRICE_COMING_SOON;
}
