import Link from 'next/link';
import { site } from '@/lib/site';
import { isPurchasable, type Product } from '@/lib/commerce';
import { RENDERS } from '@/lib/commerce/renders';
import { formatPrice } from '@/lib/format';
import { modelUrl } from '@/lib/three/models';
import shell from '../section.module.css';
import { Entrance } from './Entrance';
import { LakeMotion } from './LakeMotion';
import { ProductPlate } from './ProductPlate';
import styles from './Products.module.css';

/** A product's 1 kg price, or null while it is not set (lib/commerce/pricing.ts). */
const priceOf = (p: Product | null) => {
  const v = p?.variants[0];
  return v && isPurchasable(v) ? v.price : null;
};
/** The jar and pouch variants of a salt (local-data.ts: the pouch's id ends in -pouch-1kg). */
const variant = (p: Product, pouch: boolean) =>
  p.variants.find((v) => v.id.endsWith('-pouch-1kg') === pouch) ?? null;
const priceText = (v: Product['variants'][number] | null) =>
  v && isPurchasable(v) ? formatPrice(v.price) : null;

/** A salt's two formats for its plate: the jar (its 3D model) and the 1 kg refill pouch. */
function formatsOf(p: Product, name: 'black' | 'lake' | 'pink', alt: string) {
  const jar = variant(p, false)!;
  const pouch = variant(p, true);
  return {
    jar: {
      variantId: jar.id,
      size: '1 kg jar',
      price: priceText(jar),
      render: { name, ...RENDERS[name], alt: `${alt}, 1 kg jar` },
      model: p.model ?? modelUrl(`pyoor-${p.handle}.glb`),
      label: p.handle,
    },
    ...(pouch && {
      pouch: {
        variantId: pouch.id,
        size: '1 kg pouch',
        price: priceText(pouch),
        render: {
          name: `${name}-pouch`,
          ...RENDERS[`${name}-pouch`],
          alt: `${alt}, 1 kg refill pouch`,
        },
        model: modelUrl(`pyoor-pouch-${p.handle}.glb`),
        label: `${p.handle}:pouch`,
      },
    }),
  };
}

/** The two salts' plates (Black Salt, then Lake Salt). */
function platesOf(black: Product | null, lake: Product | null) {
  return [
    black && {
      product: black,
      hindi: 'काला नमक',
      line: 'Lake salt, slow-processed the traditional way.',
      formats: formatsOf(black, 'black', 'Pyoor Herbal Black Salt'),
    },
    lake && {
      product: lake,
      hindi: 'सफ़ेद नमक',
      line: 'Sun-dried crystals from the pans of Sambhar.',
      formats: formatsOf(lake, 'lake', 'Pyoor Natural Lake Salt'),
    },
  ].filter((x) => !!x);
}

const HEADLINE = 'From the lake, to your kitchen.';

/**
 * Step 4 opens inside the hero's pin ("the lake opens": LakeMotion): the gold rule, the
 * headline (letter by letter, each in its word's mask) and the two salts' plates. It is the
 * pinned stage's last layer, behind the pans, which split apart to show it; once the pin
 * releases it scrolls on as the top of the products, the rest (Products) following.
 */
export function LakeOpening({ black, lake }: { black: Product | null; lake: Product | null }) {
  const plates = platesOf(black, lake);
  const words = HEADLINE.split(' ');
  let n = 0;
  return (
    <section className={styles.lake} aria-labelledby="shop-title" data-lake>
      <span id="shop" data-pin-end />
      <span className={styles.lakeRule} aria-hidden="true" data-lake-rule />
      <div className="py-wrap">
        <h2 id="shop-title" className={`py-display py-d-l ${styles.title}`} aria-label={HEADLINE}>
          {words.map((w, i) => (
            <span key={i} aria-hidden="true">
              <span className={styles.word}>
                {[...w].map((c) => (
                  <span
                    key={n}
                    className={styles.ch}
                    data-lake-ch
                    style={{ '--n': n++ } as React.CSSProperties}
                  >
                    {c}
                  </span>
                ))}
              </span>
              {i < words.length - 1 ? ' ' : ''}
            </span>
          ))}
        </h2>
        <div className={styles.plates}>
          {plates.map((x, i) => (
            <ProductPlate
              key={x.product.handle}
              arm
              index={i + 1}
              handle={x.product.handle}
              title={x.product.title}
              hindi={x.hindi}
              line={x.line}
              formats={x.formats}
            />
          ))}
        </div>
      </div>
      <LakeMotion />
    </section>
  );
}

/**
 * The rest of the products, after the hero's pin (the two salts open in it: LakeOpening): The
 * Pair, a trust strip. Prices and the bag come from lib/commerce (pricing.ts is the one place
 * prices are set). COPY: every line marked is awaiting sign-off. No health claims.
 */
export function Products({
  black,
  lake,
  pink,
  pair,
}: {
  black: Product | null;
  lake: Product | null;
  /** Pink Rock Salt: null while hidden (SHOW_PINK_SALT, lib/commerce/pricing.ts) */
  pink: Product | null;
  pair: Product | null;
}) {
  const pb = priceOf(black);
  const pl = priceOf(lake);
  const pp = priceOf(pair);
  // the pair's saving against one of each, when all three prices are set
  const save = pb && pl && pp ? pb.amount + pl.amount - pp.amount : 0;

  return (
    <section className={`${shell.blk} ${styles.products}`} aria-label="Products" data-products>
      <div className="py-wrap">
        {/* beyond the lake: a third plate, set apart */}
        {pink && (
          <div className={styles.beyond}>
            <h2 className={styles.chapter}>Beyond the lake</h2>
            <p className={styles.beyondLine}>A rock salt we pack with the same care.</p>
            <div className={styles.beyondPlate}>
              <ProductPlate
                index={3}
                handle={pink.handle}
                title={pink.title}
                hindi="सेंधा नमक"
                line="Rock salt (sendha namak), in a jar or a refill pouch."
                formats={formatsOf(pink, 'pink', 'Pyoor Pink Rock Salt')}
              />
            </div>
          </div>
        )}
        {pair && (
          <ProductPlate
            wide
            index={3}
            handle={pair.handle}
            title="The Pair"
            line="One of each, 2 × 1 kg"
            saving={save > 0 ? `Save ${formatPrice({ amount: save, currencyCode: 'INR' })}` : null}
            formats={{
              jar: {
                variantId: pair.variants[0]!.id,
                size: '2 × 1 kg',
                price: pp ? formatPrice(pp) : null,
                render: {
                  name: 'pair',
                  ...RENDERS.pair,
                  alt: 'Pyoor Herbal Black Salt and Natural Lake Salt jars side by side',
                },
              },
            }}
          />
        )}
        <p className={styles.trust} data-rise style={{ '--i': 4 } as React.CSSProperties}>
          <span>FSSAI Lic. No. {site.company.fssaiLicence}</span>
          <span>Lab-tested</span>
          <span>Checked by batch</span>
          <span>Packed at Sambhar</span>
          <span>Cash on delivery</span>
        </p>
        <p className={styles.all}>
          <Link href="/shop">
            See all salts <span aria-hidden="true">→</span>
          </Link>
        </p>
      </div>
      <Entrance />
    </section>
  );
}
