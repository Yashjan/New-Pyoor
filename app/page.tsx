import { JarHero } from '@/components/hero/JarHero';
import { HomeMotion } from '@/components/motion/HomeMotion';
import { Fire } from '@/components/sections/Fire/Fire';
import { Crystals } from '@/components/sections/Crystals/Crystals';
import { Recipes } from '@/components/sections/Recipes/Recipes';
import { LakeOpening, Products } from '@/components/sections/Products/Products';
import { Roots } from '@/components/sections/Roots/Roots';
import { getProduct, getProducts, isPurchasable, type Money } from '@/lib/commerce';
import { formatPrice } from '@/lib/format';
import type { Metadata } from 'next';

export const metadata: Metadata = { alternates: { canonical: '/' } };

/** Homepage (docs/design-handoff/hero-reference/concept.html): one idea per screen. */
export default async function HomePage() {
  const [products, black, lake, pink, pair] = await Promise.all([
    getProducts(),
    getProduct('herbal-black-salt'),
    getProduct('natural-lake-salt'),
    getProduct('pink-rock-salt'), // null while hidden (SHOW_PINK_SALT)
    getProduct('the-sambhar-pair'),
  ]);

  // "Shop the salts — from ₹249": the lowest price among products that can be bought.
  const lowest = products
    .flatMap((p) => p.variants)
    .filter(isPurchasable)
    .reduce<Money | null>((min, v) => (!min || v.price.amount < min.amount ? v.price : min), null);

  return (
    <>
      <main id="main" suppressHydrationWarning>
        <JarHero
          fromPrice={lowest ? formatPrice(lowest) : null}
          invite={
            black?.variants[0]
              ? {
                  title: black.title,
                  size: '1 kg jar',
                  price: isPurchasable(black.variants[0])
                    ? formatPrice(black.variants[0].price)
                    : null,
                  variantId: black.variants[0].id,
                }
              : null
          }
          lake={<LakeOpening black={black} lake={lake} />}
        />
        {/* the products' opening is the hero's last layer ("the lake opens"); the rest follows */}
        <Products black={black} lake={lake} pink={pink} pair={pair} />
        <Fire />
        <Crystals />
        <Roots />
        <Recipes />
        <HomeMotion />
      </main>
    </>
  );
}
