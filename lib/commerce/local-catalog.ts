import { products } from './local-data';
import type { CatalogProvider, GetProductsOptions, Product } from './types';

/** Catalogue backed by local-data.ts. Async to match the future Shopify provider. */
export const localCatalog: CatalogProvider = {
  async getProducts({ includeUnpublished = false }: GetProductsOptions = {}): Promise<Product[]> {
    return includeUnpublished ? products : products.filter((p) => p.published);
  },

  async getProduct(handle: string): Promise<Product | null> {
    return products.find((p) => p.handle === handle && p.published) ?? null;
  },
};

/** Synchronous lookup used by the local cart to resolve variant ids. */
export function findVariant(variantId: string) {
  for (const product of products) {
    if (!product.published) continue;
    const variant = product.variants.find((v) => v.id === variantId);
    if (variant) return { product, variant };
  }
  return null;
}
