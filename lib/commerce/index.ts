/**
 * The only entry point the app uses for commerce. Components and pages import from
 * `@/lib/commerce`; nothing outside this folder knows which backend is in use.
 *
 * Today: local JSON catalogue + localStorage cart.
 * Later: swap the two provider imports below for Shopify Storefront API implementations
 * (shopify-catalog.ts / shopify-cart.ts) that satisfy the same interfaces in ./types.
 */
import { localCart } from './local-cart';
import { localCatalog } from './local-catalog';
import type { CartProvider, CatalogProvider } from './types';

const catalog: CatalogProvider = localCatalog;
const cart: CartProvider = localCart;

export const getProducts = catalog.getProducts;
export const getProduct = catalog.getProduct;

export const getCart = cart.getCart;
export const addToCart = cart.addToCart;
export const updateCartLine = cart.updateCartLine;
export const removeFromCart = cart.removeFromCart;

export { MAX_LINE_QUANTITY } from './local-cart';
export type * from './types';
