/**
 * Commerce domain types. These are backend-agnostic: the local JSON provider implements
 * them today, a Shopify Storefront API provider will implement them later. Components only
 * ever import from `@/lib/commerce`, never from a provider file directly.
 *
 * Shapes intentionally mirror Shopify's Storefront API (Product → variants, Cart → lines,
 * MoneyV2) so the Shopify provider is a thin mapping layer.
 */

export type CurrencyCode = 'INR';

/** Mirrors Shopify MoneyV2. `amount` is in major units (rupees), e.g. 249 → ₹249. */
export interface Money {
  amount: number;
  currencyCode: CurrencyCode;
}

export interface Image {
  url: string;
  alt: string;
  width: number;
  height: number;
}

/** A factual row for the product facts table (origin, ingredients, size, storage…). */
export interface ProductFact {
  label: string;
  value: string;
}

export interface ProductVariant {
  id: string;
  title: string; // e.g. "1 kg jar"
  sku: string;
  /** `null` while the price is not yet confirmed; the UI shows "[PRICE]". */
  price: Money | null;
  availableForSale: boolean;
  weightGrams: number;
}

/** For bundles such as The Sambhar Pair: which products and how many of each. */
export interface BundleComponent {
  handle: string;
  quantity: number;
}

export interface Product {
  id: string;
  handle: string;
  title: string;
  /** Hindi name shown as an accent, e.g. "काला नमक". */
  titleHindi?: string;
  /** One short factual line for cards and the hero. */
  summary: string;
  /** Longer factual description (origin, ingredients, process, taste, use). */
  description: string;
  /** Unpublished products are kept in data but never listed or routable. */
  published: boolean;
  variants: ProductVariant[];
  featuredImage: Image | null;
  images: Image[];
  /** Compressed .glb in /public/models, if this product has a 3D jar. */
  model: string | null;
  ingredients: string[];
  facts: ProductFact[];
  bundle?: BundleComponent[];
  tags: string[];
  seo: { title: string; description: string };
}

export interface CartLine {
  id: string;
  quantity: number;
  merchandise: {
    variantId: string;
    variantTitle: string;
    product: Pick<Product, 'handle' | 'title' | 'featuredImage'>;
  };
  unitPrice: Money | null;
  /** `null` if the unit price is unknown. */
  lineTotal: Money | null;
}

export interface Cart {
  id: string;
  lines: CartLine[];
  totalQuantity: number;
  /** Sum of lines with a known price. */
  subtotal: Money;
  /** True if any line has no confirmed price yet, so the subtotal is incomplete. */
  hasUnpricedLines: boolean;
  /** Shopify checkout URL once connected; `null` while checkout is not open. */
  checkoutUrl: string | null;
}

export interface GetProductsOptions {
  /** Include `published: false` products (internal use only, never in the UI). */
  includeUnpublished?: boolean;
}

/** Read-only catalogue. Safe to call from Server Components. */
export interface CatalogProvider {
  getProducts(options?: GetProductsOptions): Promise<Product[]>;
  getProduct(handle: string): Promise<Product | null>;
}

/** Cart operations. Called from the browser (local: localStorage; Shopify: Cart API). */
export interface CartProvider {
  getCart(): Promise<Cart>;
  addToCart(variantId: string, quantity?: number): Promise<Cart>;
  updateCartLine(lineId: string, quantity: number): Promise<Cart>;
  removeFromCart(lineId: string): Promise<Cart>;
}
