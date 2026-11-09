import { findVariant } from './local-catalog';
import type { Cart, CartLine, CartProvider, Money } from './types';

/**
 * Cart persisted in localStorage. Only the minimum is stored (variant id + quantity);
 * titles and prices are re-resolved from the catalogue on every read, so a price change
 * in local-data.ts is reflected immediately and stale data never reaches the UI.
 */

const STORAGE_KEY = 'pyoor:cart:v1';
export const MAX_LINE_QUANTITY = 20;

interface StoredLine {
  id: string;
  variantId: string;
  quantity: number;
}

interface StoredCart {
  id: string;
  lines: StoredLine[];
}

const emptyStored = (): StoredCart => ({ id: 'local-cart', lines: [] });

function read(): StoredCart {
  if (typeof window === 'undefined') return emptyStored();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyStored();
    const parsed = JSON.parse(raw) as Partial<StoredCart>;
    if (!Array.isArray(parsed.lines)) return emptyStored();
    return {
      id: typeof parsed.id === 'string' ? parsed.id : 'local-cart',
      lines: parsed.lines.filter(
        (l): l is StoredLine =>
          typeof l?.id === 'string' &&
          typeof l.variantId === 'string' &&
          Number.isInteger(l.quantity) &&
          l.quantity > 0,
      ),
    };
  } catch {
    return emptyStored(); // corrupt JSON or storage blocked (private mode)
  }
}

function write(cart: StoredCart): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
  } catch {
    // Storage full or blocked: the cart still works for this page view.
  }
}

const clampQty = (q: number) => Math.max(0, Math.min(MAX_LINE_QUANTITY, Math.floor(q)));

function multiply(money: Money | null, quantity: number): Money | null {
  return money ? { amount: money.amount * quantity, currencyCode: money.currencyCode } : null;
}

function hydrate(stored: StoredCart): Cart {
  const lines: CartLine[] = [];
  for (const line of stored.lines) {
    const match = findVariant(line.variantId);
    if (!match) continue; // product removed or unpublished since it was added
    const { product, variant } = match;
    lines.push({
      id: line.id,
      quantity: line.quantity,
      merchandise: {
        variantId: variant.id,
        variantTitle: variant.title,
        product: {
          handle: product.handle,
          title: product.title,
          featuredImage: product.featuredImage,
        },
      },
      unitPrice: variant.price,
      lineTotal: multiply(variant.price, line.quantity),
    });
  }

  return {
    id: stored.id,
    lines,
    totalQuantity: lines.reduce((sum, l) => sum + l.quantity, 0),
    subtotal: {
      amount: lines.reduce((sum, l) => sum + (l.lineTotal?.amount ?? 0), 0),
      currencyCode: 'INR',
    },
    hasUnpricedLines: lines.some((l) => l.unitPrice === null),
    checkoutUrl: null, // "Checkout opens soon"
  };
}

function mutate(fn: (cart: StoredCart) => void): Cart {
  const cart = read();
  fn(cart);
  cart.lines = cart.lines.filter((l) => l.quantity > 0);
  write(cart);
  return hydrate(cart);
}

export const localCart: CartProvider = {
  async getCart() {
    return hydrate(read());
  },

  async addToCart(variantId, quantity = 1) {
    if (!findVariant(variantId)) throw new Error(`Unknown variant: ${variantId}`);
    return mutate((cart) => {
      const existing = cart.lines.find((l) => l.variantId === variantId);
      if (existing) existing.quantity = clampQty(existing.quantity + quantity);
      else cart.lines.push({ id: `line:${variantId}`, variantId, quantity: clampQty(quantity) });
    });
  },

  async updateCartLine(lineId, quantity) {
    return mutate((cart) => {
      const line = cart.lines.find((l) => l.id === lineId);
      if (line) line.quantity = clampQty(quantity);
    });
  },

  async removeFromCart(lineId) {
    return mutate((cart) => {
      cart.lines = cart.lines.filter((l) => l.id !== lineId);
    });
  },
};
