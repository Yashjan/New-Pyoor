import type { Money } from '@/lib/commerce';

const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
});

/** "₹249", or the visible placeholder "₹[PRICE]" while a price is unconfirmed. */
export function formatPrice(money: Money | null): string {
  return money ? inr.format(money.amount) : '₹[PRICE]';
}
