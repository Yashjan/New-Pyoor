import { isPurchasable, type Product } from '@/lib/commerce';
import { RENDERS } from '@/lib/commerce/renders';
import { formatPrice } from '@/lib/format';
import { modelUrl } from '@/lib/three/models';
import shell from '../section.module.css';
import { Entrance } from './Entrance';
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
function formatsOf(p: Product, name: 'black' | 'lake', alt: string) {
  const jar = variant(p, false)!;
  const pouch = variant(p, true);
  return {
    jar: {
      variantId: jar.id,
      size: '1 kg jar',
      price: priceText(jar),
      render: { name, ...RENDERS[name], alt: `${alt}, 1 kg jar` },
      model: modelUrl(`pyoor-${p.handle}.glb`),
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

/**
 * Step 4, the products, straight after the salt pans: the gold horizon continues as the top
 * rule, two plates (Black Salt, Lake Salt), The Pair below, a trust strip. Prices and the
 * bag come from lib/commerce (pricing.ts is the one place prices are set).
 * COPY: every line marked [CONFIRM] in the reply is awaiting sign-off. No health claims.
 */
export function Products({
  black,
  lake,
  pair,
}: {
  black: Product | null;
  lake: Product | null;
  pair: Product | null;
}) {
  const pb = priceOf(black);
  const pl = priceOf(lake);
  const pp = priceOf(pair);
  // the pair's saving against one of each, when all three prices are set
  const save = pb && pl && pp ? pb.amount + pl.amount - pp.amount : 0;
  const plates = [
    black && {
      product: black,
      hindi: 'काला नमक', // [CONFIRM]
      line: 'Lake salt, slow-processed the traditional way.', // [CONFIRM]
      formats: formatsOf(black, 'black', 'Pyoor Herbal Black Salt'),
    },
    lake && {
      product: lake,
      hindi: 'सांभर नमक', // [CONFIRM]
      line: 'Sun-dried crystals from the pans of Sambhar.', // [CONFIRM]
      formats: formatsOf(lake, 'lake', 'Pyoor Natural Lake Salt'),
    },
  ].filter((x) => !!x);

  return (
    <section
      className={`${shell.blk} ${styles.products}`}
      id="shop"
      aria-labelledby="shop-title"
      data-products
    >
      {/* the pans' gold horizon, continued */}
      <span className={styles.rule} aria-hidden="true" />
      <div className="py-wrap">
        {/* [CONFIRM COPY] */}
        <h2 id="shop-title" className={`py-display py-d-l ${styles.title}`} data-rise>
          From the lake, to your kitchen.
        </h2>
        <div className={styles.plates}>
          {plates.map((x, i) => (
            <ProductPlate
              key={x.product.handle}
              index={i + 1}
              handle={x.product.handle}
              title={x.product.title}
              hindi={x.hindi}
              line={x.line}
              formats={x.formats}
            />
          ))}
        </div>
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
        {/* [CONFIRM] */}
        <p className={styles.trust} data-rise style={{ '--i': 4 } as React.CSSProperties}>
          <span>FSSAI licensed</span>
          <span>Packed at Sambhar</span>
          <span>Batch-dated</span>
          <span>Cash on delivery</span>
        </p>
      </div>
      <Entrance />
    </section>
  );
}
