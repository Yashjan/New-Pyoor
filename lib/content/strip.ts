import type { StripSalt } from '@/components/recipes/SaltStrip';
import { getProduct } from '@/lib/commerce';
import { formatPrice } from '@/lib/format';
import { asset } from '@/lib/basePath';

/** The plates' still renders (public/images/renders), for products without a photo. */
const STILLS: Record<string, { url: string; alt: string }> = {
  'herbal-black-salt': {
    url: '/images/renders/black-studio.webp',
    alt: 'Pyoor Herbal Black Salt in its 1 kg jar',
  },
  'natural-lake-salt': {
    url: '/images/renders/lake-studio.webp',
    alt: 'Pyoor Natural Lake Salt in its 1 kg jar',
  },
};

/**
 * The salts' rows for a SaltStrip: image, Jar · Pouch, price (null: not addable). `stills`:
 * the plates' renders always (the story pages' shop strip); otherwise the product photo, or the
 * render while there is none.
 */
export async function stripSalts(
  handles: readonly string[],
  { stills = false } = {},
): Promise<StripSalt[]> {
  const out: StripSalt[] = [];
  for (const handle of handles) {
    const p = await getProduct(handle);
    if (!p) continue;
    const fmt = (v: (typeof p.variants)[number]) => ({
      id: v.id,
      size: v.title,
      price: v.price && v.availableForSale ? formatPrice(v.price) : null,
    });
    const [jar, pouch] = p.variants;
    if (!jar) continue;
    out.push({
      handle,
      title: p.title,
      image:
        (stills || !p.featuredImage) && STILLS[handle]
          ? { url: asset(STILLS[handle].url), alt: STILLS[handle].alt }
          : { url: p.featuredImage?.url ?? '', alt: p.featuredImage?.alt ?? '' },
      jar: fmt(jar),
      pouch: pouch ? fmt(pouch) : undefined,
    });
  }
  return out;
}
