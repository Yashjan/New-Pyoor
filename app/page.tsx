import { JarHero } from '@/components/hero/JarHero';
import { HomeMotion } from '@/components/motion/HomeMotion';
import { Crystals } from '@/components/sections/Crystals/Crystals';
import { Recipes } from '@/components/sections/Recipes/Recipes';
import { Products } from '@/components/sections/Products/Products';
import { Roots } from '@/components/sections/Roots/Roots';
import { getProduct, getProducts, isPurchasable, type Money } from '@/lib/commerce';
import { formatPrice } from '@/lib/format';

/** Homepage (docs/design-handoff/hero-reference/concept.html): one idea per screen. */
export default async function HomePage() {
  const [products, black, lake, pair] = await Promise.all([
    getProducts(),
    getProduct('herbal-black-salt'),
    getProduct('natural-lake-salt'),
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
        <JarHero fromPrice={lowest ? formatPrice(lowest) : null} />
        {/* the salt pans (the hero's step 3) release straight into the products */}
        <Products black={black} lake={lake} pair={pair} />
        <Roots />
        <Crystals />
        <Recipes />
        <HomeMotion />
      </main>
    </>
  );
}
