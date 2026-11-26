import type { CartLine } from '@/lib/commerce';

/** Line thumbnails: the products section's studio stills (the pouch's for a pouch line). */
export const THUMBS: Record<string, string> = {
  'herbal-black-salt': '/images/renders/black-studio.webp',
  'natural-lake-salt': '/images/renders/lake-studio.webp',
  'the-sambhar-pair': '/images/renders/pair-studio.webp',
  'pink-rock-salt': '/images/renders/pink-studio.webp',
};
export const POUCH_THUMBS: Record<string, string> = {
  'herbal-black-salt': '/images/renders/black-pouch-studio.webp',
  'natural-lake-salt': '/images/renders/lake-pouch-studio.webp',
  'pink-rock-salt': '/images/renders/pink-pouch-studio.webp',
};
/** A salt's refill pouch variant id from its jar's (local-data.ts). */
export const isPouch = (variantId: string) => variantId.endsWith('-pouch-1kg');
export const pouchOf = (jarVariantId: string) => jarVariantId.replace(/-1kg$/, '-pouch-1kg');
export const thumbOf = (line: CartLine) => {
  const h = line.merchandise.product.handle;
  return (isPouch(line.merchandise.variantId) && POUCH_THUMBS[h]) || THUMBS[h];
};
