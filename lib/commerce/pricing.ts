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
  // every 1 kg jar ₹199, every 1 kg refill pouch ₹149
  'local:variant:herbal-black-salt-1kg': 199,
  'local:variant:natural-lake-salt-1kg': 199,
  'local:variant:pink-rock-salt-1kg': 199,
  'local:variant:herbal-black-salt-pouch-1kg': 149,
  'local:variant:natural-lake-salt-pouch-1kg': 149,
  'local:variant:pink-rock-salt-pouch-1kg': 149,
  // The Pair: hidden (SHOW_PAIR)
  'local:variant:the-sambhar-pair': null,
};

export const FREE_SHIPPING_THRESHOLD_INR: number | null = null;

/**
 * The pouches' back artwork (it carries health-claim paragraphs until it is corrected): while
 * false, visitors never see it: the pouch label reader shows only the Front sheet, and the 3D
 * pouch turns at most ±60°.
 */
export const SHOW_POUCH_BACK = false;

/**
 * Pink Rock Salt: listed only while true (products, menu, bag, sitemap, structured data,
 * routes). Live.
 */
export const SHOW_PINK_SALT: boolean = true;

/** "The Sambhar Pair": listed only while true (products, bag, sitemap, structured data, routes). */
export const SHOW_PAIR: boolean = false;
