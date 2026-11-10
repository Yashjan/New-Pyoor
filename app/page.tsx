import { JarHero } from '@/components/hero/JarHero';
import { IntroLoader } from '@/components/IntroLoader/IntroLoader';
import { HomeMotion } from '@/components/motion/HomeMotion';
import { Crystals } from '@/components/sections/Crystals/Crystals';
import { Journey } from '@/components/sections/Journey/Journey';
import { Recipes } from '@/components/sections/Recipes/Recipes';
import { Roots } from '@/components/sections/Roots/Roots';
import { Salts } from '@/components/sections/Salts/Salts';
import { getProduct, getProducts, isPurchasable, type Money } from '@/lib/commerce';
import { formatPrice } from '@/lib/format';

/** Runs as <main> is parsed: busy until the first-visit loader reveals the page. */
const MAIN_BUSY = `document.documentElement.getAttribute('data-intro')==='full'&&document.currentScript.parentNode.setAttribute('aria-busy','true')`;

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
    <>
      <IntroLoader />
      {/* aria-busy is set by MAIN_BUSY before hydration, so React must not fight over it. */}
      <main id="main" suppressHydrationWarning>
        <script dangerouslySetInnerHTML={{ __html: MAIN_BUSY }} />
        <JarHero fromPrice={lowest ? formatPrice(lowest) : null} />
        <Roots />
        <Journey />
        <Salts black={black} lake={lake} />
        <Crystals />
        <Recipes />
        <HomeMotion />
      </main>
    </>
  );
}
