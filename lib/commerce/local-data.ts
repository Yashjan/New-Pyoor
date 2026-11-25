/**
 * Local product catalogue used until the Shopify Storefront API is connected.
 *
 * COPY RULES (strict): factual only. Origin, ingredients, process, size, price, taste, use.
 * No health, medicinal or nutritional claims. Unknown values use [BRACKETED] placeholders.
 */
import { PRICES_INR, SHOW_PAIR, SHOW_PINK_SALT } from './pricing';
import type { Image, Money, Product } from './types';
import { modelUrl } from '@/lib/three/models';

/** Price for a variant from pricing.ts (null while not set). */
function priceOf(variantId: string): Money | null {
  const amount = PRICES_INR[variantId];
  return amount == null ? null : { amount, currencyCode: 'INR' };
}

const JAR = { title: '1 kg jar', weightGrams: 1000 } as const;
const POUCH = { title: '1 kg refill pouch', weightGrams: 1000 } as const;
const PACKED_BY =
  'Pyoor Global Enterprises, 58-R Shiv Vihar Colony, Phulera Road, Sambhar Lake, Jaipur, Rajasthan 303604';

const blackSaltPhoto: Image = {
  url: '/images/jar-black-salt-photo.jpg',
  alt: 'Pyoor Herbal Black Salt in a 1 kg clear jar',
  width: 1400,
  height: 1867,
};

const pairPhoto: Image = {
  url: '/images/jars-dusk.jpg',
  alt: 'Pyoor Herbal Black Salt and Natural Lake Salt jars side by side at dusk',
  width: 1400,
  height: 1405,
};

const commonFacts = [
  { label: 'Origin', value: 'Sambhar Lake, Rajasthan, India' },
  { label: 'Net weight', value: '1 kg' },
  { label: 'Pack', value: 'Clear PET jar with screw cap' },
  { label: 'Storage', value: 'Store in a cool, dry place. Close the lid after use.' },
  { label: 'Best before', value: '24 months from manufacture' },
  { label: 'Packed by', value: PACKED_BY },
  { label: 'FSSAI Lic. No.', value: '12224999000443' },
];

export const products: Product[] = [
  {
    id: 'local:product:herbal-black-salt',
    handle: 'herbal-black-salt',
    title: 'Herbal Black Salt',
    titleHindi: 'काला नमक',
    summary: 'Sambhar Lake salt with harad, baheda and amla.',
    description:
      'Black salt made from Sambhar Lake salt with harad, baheda and amla, packed at the lake. ' +
      'Sulphurous and tangy, with the distinct aroma of kala namak. ' +
      'Made for chaat, raita, fruit, chaas and nimbu pani.',
    published: true,
    variants: [
      {
        id: 'local:variant:herbal-black-salt-1kg',
        sku: 'PYR-HBS-1KG',
        price: priceOf('local:variant:herbal-black-salt-1kg'),
        availableForSale: true,
        ...JAR,
      },
      {
        id: 'local:variant:herbal-black-salt-pouch-1kg',
        sku: 'PYR-HBS-P1KG',
        price: priceOf('local:variant:herbal-black-salt-pouch-1kg'),
        availableForSale: true,
        ...POUCH,
      },
    ],
    featuredImage: blackSaltPhoto,
    images: [blackSaltPhoto],
    model: modelUrl('pyoor-herbal-black-salt.glb'),
    ingredients: [
      'Sambhar Lake salt',
      'Harad (Terminalia chebula)',
      'Baheda (Terminalia bellirica)',
      'Amla (Phyllanthus emblica)',
      'Babul bark',
      'Nausadar (ammonium chloride)',
    ],
    facts: [
      { label: 'Product', value: 'Herbal black salt (काला नमक)' },
      {
        label: 'Ingredients',
        value: 'Sambhar lake salt, harad, baheda, amla, babul bark, nausadar (ammonium chloride)',
      },
      { label: 'Iodised', value: 'Yes' },
      ...commonFacts,
    ],
    tags: ['black-salt', 'kala-namak'],
    seo: {
      title: 'Herbal Black Salt (काला नमक), 1 kg',
      description:
        'Black salt made from Sambhar Lake salt with harad, baheda and amla. 1 kg clear jar, packed at Sambhar Lake, Rajasthan.',
    },
  },
  {
    id: 'local:product:natural-lake-salt',
    handle: 'natural-lake-salt',
    title: 'Natural Lake Salt',
    titleHindi: 'सफ़ेद नमक',
    summary: 'Harvested from Sambhar Lake and sun-dried.',
    description:
      'White salt harvested from the salt pans of Sambhar Lake and dried in the sun, then packed at the lake. ' +
      'A clean, bright saltiness for everyday cooking: dal, sabzi, rotis and baking.',
    published: true,
    variants: [
      {
        id: 'local:variant:natural-lake-salt-1kg',
        sku: 'PYR-NLS-1KG',
        price: priceOf('local:variant:natural-lake-salt-1kg'),
        availableForSale: true,
        ...JAR,
      },
      {
        id: 'local:variant:natural-lake-salt-pouch-1kg',
        sku: 'PYR-NLS-P1KG',
        price: priceOf('local:variant:natural-lake-salt-pouch-1kg'),
        availableForSale: true,
        ...POUCH,
      },
    ],
    featuredImage: null, // [PHOTO TO SHOOT]
    images: [],
    model: modelUrl('pyoor-natural-lake-salt.glb'),
    ingredients: ['Sambhar Lake salt'],
    facts: [
      { label: 'Product', value: 'Natural lake salt (सफ़ेद नमक)' },
      { label: 'Ingredients', value: 'Salt from Sambhar Lake' },
      { label: 'Process', value: 'Harvested from the lake and sun-dried' },
      { label: 'Iodised', value: 'Yes' },
      ...commonFacts,
    ],
    tags: ['lake-salt', 'white-salt', 'safed-namak'],
    seo: {
      title: 'Natural Lake Salt (सफ़ेद नमक), 1 kg',
      description:
        'Salt harvested from Sambhar Lake, Rajasthan, and sun-dried. 1 kg clear jar, packed at the lake.',
    },
  },
  {
    id: 'local:product:the-sambhar-pair',
    handle: 'the-sambhar-pair',
    title: 'The Sambhar Pair',
    summary: 'One jar of Herbal Black Salt and one of Natural Lake Salt.',
    description:
      'Both Pyoor salts from Sambhar Lake: one 1 kg jar of Herbal Black Salt and one 1 kg jar of Natural Lake Salt.',
    published: SHOW_PAIR,
    variants: [
      {
        id: 'local:variant:the-sambhar-pair',
        sku: 'PYR-PAIR-2KG',
        title: '2 × 1 kg jars',
        price: priceOf('local:variant:the-sambhar-pair'),
        availableForSale: true,
        weightGrams: 2000,
      },
    ],
    featuredImage: pairPhoto,
    images: [pairPhoto],
    model: null,
    ingredients: [],
    bundle: [
      { handle: 'herbal-black-salt', quantity: 1 },
      { handle: 'natural-lake-salt', quantity: 1 },
    ],
    facts: [
      { label: 'Contains', value: '1 × Herbal Black Salt 1 kg, 1 × Natural Lake Salt 1 kg' },
      { label: 'Origin', value: 'Sambhar Lake, Rajasthan, India' },
      { label: 'Net weight', value: '2 kg (2 × 1 kg)' },
      { label: 'Packed by', value: PACKED_BY },
      { label: 'FSSAI Lic. No.', value: '12224999000443' },
    ],
    tags: ['bundle'],
    seo: {
      title: 'The Sambhar Pair: Black Salt and Lake Salt',
      description:
        'One 1 kg jar of Herbal Black Salt and one 1 kg jar of Natural Lake Salt, both from Sambhar Lake, Rajasthan.',
    },
  },
  {
    // behind SHOW_PINK_SALT (pricing.ts). COPY: no origin text until confirmed; no claims.
    id: 'local:product:pink-rock-salt',
    handle: 'pink-rock-salt',
    title: 'Pink Rock Salt',
    titleHindi: 'सेंधा नमक',
    summary: 'Rock salt (sendha namak), packed with the same care.',
    description:
      'Pink rock salt (sendha namak), in a 1 kg clear jar or a 1 kg refill pouch.',
    published: SHOW_PINK_SALT,
    variants: [
      {
        id: 'local:variant:pink-rock-salt-1kg',
        sku: 'PYR-PRS-1KG',
        price: priceOf('local:variant:pink-rock-salt-1kg'),
        availableForSale: true,
        ...JAR,
      },
      {
        id: 'local:variant:pink-rock-salt-pouch-1kg',
        sku: 'PYR-PRS-P1KG',
        price: priceOf('local:variant:pink-rock-salt-pouch-1kg'),
        availableForSale: true,
        ...POUCH,
      },
    ],
    featuredImage: null,
    images: [],
    model: modelUrl('pyoor-jar-pink-rock-salt.glb'),
    ingredients: ['Rock salt (sendha namak)'],
    facts: [
      { label: 'Product', value: 'Pink rock salt (सेंधा नमक)' },
      { label: 'Ingredients', value: 'Rock salt (sendha namak)' },
      { label: 'Net weight', value: '1 kg' },
      { label: 'Packed by', value: PACKED_BY },
      { label: 'FSSAI Lic. No.', value: '12224999000443' },
    ],
    tags: ['rock-salt', 'sendha-namak'],
    seo: {
      title: 'Pink Rock Salt (सेंधा नमक), 1 kg',
      description: 'Pink rock salt (sendha namak) by Pyoor: 1 kg clear jar or 1 kg refill pouch.',
    },
  },
];
