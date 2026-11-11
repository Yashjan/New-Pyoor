/**
 * PRICES AND SHIPPING: the one place to fill in.
 *
 * Amounts are in rupees (MRP, inclusive of taxes). `null` means "not set yet":
 *   - a product with a null price shows "Price coming soon" and cannot be added to the cart;
 *   - a null free-shipping threshold hides the "Free shipping above …" message.
 *
 * When Shopify is connected, prices come from Shopify instead and this file goes away.
 */

export const PRICES_INR: Record<string, number | null> = {
  'local:variant:herbal-black-salt-1kg': 249,
  'local:variant:natural-lake-salt-1kg': null,
  'local:variant:the-sambhar-pair': null,
  'local:variant:himalayan-pink-salt-1kg': null, // not in launch
};

export const FREE_SHIPPING_THRESHOLD_INR: number | null = null;
