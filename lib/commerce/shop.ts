import { formatPrice } from '@/lib/format';
import { RENDERS } from './renders';
import { getProducts } from './index';
import { isPurchasable, type Product } from './types';

/** The salts in the shop, in order, with their filter key and studio-still name. */
export const SALTS = [
  { handle: 'herbal-black-salt', key: 'black' },
  { handle: 'natural-lake-salt', key: 'lake' },
  { handle: 'pink-rock-salt', key: 'pink' },
] as const;
export type SaltKey = (typeof SALTS)[number]['key'];
export type ShopFormat = 'jar' | 'pouch';

export interface ShopFormatData {
  variantId: string;
  /** "1 kg jar" */
  size: string;
  /** "₹199", or null while it can't be bought */
  price: string | null;
  /** the studio still: /images/renders/<name>-studio.{avif,webp} */
  render: { name: string; width: number; height: number; blur: string; alt: string };
}

export interface ShopSalt {
  handle: string;
  key: SaltKey;
  title: string;
  hindi: string;
  line: string;
  formats: { jar: ShopFormatData; pouch?: ShopFormatData };
}

export const shopHref = (handle: string) => `/shop/${handle}`;
export const stillSrc = (name: string, ext: 'avif' | 'webp') =>
  `/images/renders/${name}-studio.${ext}`;

function formatOf(p: Product, key: SaltKey, pouch: boolean): ShopFormatData | undefined {
  const v = p.variants.find((x) => x.id.endsWith('-pouch-1kg') === pouch);
  if (!v) return undefined;
  const name = pouch ? (`${key}-pouch` as const) : key;
  return {
    variantId: v.id,
    size: pouch ? '1 kg pouch' : '1 kg jar',
    price: isPurchasable(v) ? formatPrice(v.price) : null,
    render: {
      name,
      ...RENDERS[name],
      alt: `Pyoor ${p.title}, ${pouch ? '1 kg refill pouch' : '1 kg jar'}`,
    },
  };
}

/** The published salts as shop cards (the Pair is not a salt of its own). */
export async function shopSalts(): Promise<ShopSalt[]> {
  const products = await getProducts();
  const out: ShopSalt[] = [];
  for (const s of SALTS) {
    const p = products.find((x) => x.handle === s.handle);
    const jar = p && formatOf(p, s.key, false);
    if (!p || !jar) continue;
    out.push({
      handle: p.handle,
      key: s.key,
      title: p.title,
      hindi: p.titleHindi ?? '',
      line: p.summary,
      formats: { jar, pouch: formatOf(p, s.key, true) },
    });
  }
  return out;
}
