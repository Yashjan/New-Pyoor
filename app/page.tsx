import { Hero } from '@/components/hero/Hero';
import { RevealOnScroll } from '@/components/motion/RevealOnScroll';
import { Collection } from '@/components/sections/Collection/Collection';
import { Origin } from '@/components/sections/Origin/Origin';
import { Process } from '@/components/sections/Process/Process';
import { Recipes } from '@/components/sections/Recipes/Recipes';
import { TextureBand } from '@/components/sections/TextureBand/TextureBand';
import { TrustRow } from '@/components/sections/TrustRow/TrustRow';
import { getProducts, isPurchasable } from '@/lib/commerce';
import { formatPrice } from '@/lib/format';

export default async function HomePage() {
  const products = await getProducts();

  const prices = products
    .flatMap((p) => p.variants)
    .filter(isPurchasable)
    .map((v) => v.price);
  const lowest = prices.reduce<(typeof prices)[number] | null>(
    (min, p) => (min === null || p.amount < min.amount ? p : min),
    null,
  );

  return (
    <main id="main">
      <Hero fromPrice={lowest ? formatPrice(lowest) : null} />
      <TextureBand />
      <Collection products={products} />
      <Origin />
      <Process />
      <Recipes />
      <TrustRow />
      <RevealOnScroll />
    </main>
  );
}
