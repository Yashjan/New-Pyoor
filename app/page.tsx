import { JarHero } from '@/components/hero/JarHero';
import { HomeMotion } from '@/components/motion/HomeMotion';
import { Crystals } from '@/components/sections/Crystals/Crystals';
import { Journey } from '@/components/sections/Journey/Journey';
import { Recipes } from '@/components/sections/Recipes/Recipes';
import { Roots } from '@/components/sections/Roots/Roots';
import { Salts } from '@/components/sections/Salts/Salts';
import { getProduct, getProducts, isPurchasable, type Money } from '@/lib/commerce';
import { formatPrice } from '@/lib/format';

/** Homepage (docs/design-handoff/hero-reference/concept.html): one idea per screen. */
export default async function HomePage() {
  const [products, black, lake] = await Promise.all([
    getProducts(),
    getProduct('herbal-black-salt'),
    getProduct('natural-lake-salt'),
  ]);

  // "Shop the salts — from ₹249": the lowest price among products that can be bought.
  const lowest = products
    .flatMap((p) => p.variants)
    .filter(isPurchasable)
    .reduce<Money | null>((min, v) => (!min || v.price.amount < min.amount ? v.price : min), null);

  return (
    <main id="main">
      <JarHero fromPrice={lowest ? formatPrice(lowest) : null} />
      <Roots />
      <Journey />
      <Salts black={black} lake={lake} />
      <Crystals />
      <Recipes />
      <HomeMotion />
    </main>
  );
}
