import { SHOW_FULL_LABEL, SHOW_POUCH_BACK } from '@/lib/commerce/pricing';

/** While SHOW_FULL_LABEL is false: a jar's label as its front panel alone (tools/labels/fronts.mjs). */
const front = (handle: string, height: number, name: string, nameHindi: string) =>
  SHOW_FULL_LABEL
    ? {}
    : {
        sheets: [
          { name: 'Front', src: `/textures/label-${handle}-front.webp`, width: 1500, height },
        ],
        summary: `The front panel of the jar's printed label: Pyoor ${name} (${nameHindi}).`,
      };

/**
 * The Herbal Black Salt label as text (the label reader's accessible content), read from the
 * label artwork (tools/3d/source/labels/label-herbal-black-salt.pdf; its text is outlined, so
 * it was transcribed, not extracted). Values are as printed; anything not printed, or worth a
 * second look, was checked. The label's "About" and "Benefits" paragraphs are left out
 * on purpose: the site makes no health claims.
 */
/** One jar's label as text (the reader's panel), and its flat artwork's widths (public/textures). */
export interface LabelContent {
  name: string;
  nameHindi: string;
  brand: string;
  line: string;
  summary: string;
  ingredients: string;
  /** null: not shown (Pink Rock Salt: only name, ingredients, weight, licence, packer) */
  nutrition: { title: string; note: string; rows: readonly (readonly [string, string])[] } | null;
  netWeight: string;
  use: string;
  storage: string;
  fssai: string;
  packer: {
    title: string;
    name: string;
    address: readonly string[];
    phone: string;
    email: string;
    web: string;
  };
  perJar: readonly (readonly [string, string])[];
  origin: string;
  /** public/textures/label-<handle>-<width>.webp */
  widths: readonly number[];
  /** Flat sheets with tabs instead (the pouches: Front / Back), public/textures. */
  sheets?: readonly { name: string; src: string; width: number; height: number }[];
}

export const LABEL: LabelContent = {
  name: 'Herbal Black Salt',
  nameHindi: 'काला नमक',
  brand: 'Pyoor',
  line: 'Created from Sambhar Lake salt',
  summary:
    'The jar’s printed label, unrolled flat: the Pyoor Herbal Black Salt (काला नमक) front panel, with the ingredients, nutritional information, storage instructions, the packer’s address and the FSSAI licence number on the right-hand panels.',
  ingredients: 'Sambhar lake salt, harad, baheda, amla, babul bark, nausadar (ammonium chloride)',
  nutrition: {
    title: 'Nutritional information',
    note: 'Approximate values, per 100 g',
    rows: [
      ['Energy', '0 kcal'],
      ['Sodium', '38.90 g'],
      ['Triphala content (Amla + Harad + Baheda)', 'Positive'],
      ['Chloride content (as NaCl)', '98.90%'],
      ['Potassium', '0.02 g'],
      ['Magnesium (as Mg)', '0.01%'],
      ['Iron', '90 ppm'],
    ],
  },
  netWeight: '1 kg',
  use: '½–1 teaspoon, or as per your requirement.',
  storage: 'Keep in a cool and dry place. Store away from direct heat or sunlight.',
  fssai: '12224999000443',
  packer: {
    title: 'Packed and marketed by',
    name: 'Pyoor Global Enterprises',
    address: ['58-R, Shiv Vihar Colony, Phulera Road', 'Sambhar Lake, Jaipur, Rajasthan 303604'],
    phone: '+91 76650 09882',
    email: 'pyoorglobalenterprises@gmail.com',
    web: 'www.pyoorglobal.com',
  },
  /** printed blank on the label and filled in per batch */
  perJar: [
    ['Batch no.', 'Printed on the pack'],
    ['Date of manufacture', 'Printed on the pack'],
    ['Use by', 'Printed on the pack'],
    ['MRP', '₹199 (incl. of all taxes)'],
  ],
  origin: 'Product of India',
  widths: [4096, 8192],
  ...front('herbal-black-salt', 1050, 'Herbal Black Salt', 'काला नमक'),
};

/**
 * The Natural Lake Salt label, transcribed from the model's label artwork (2400 px:
 * tools/3d/textures/label-natural-lake-salt.png; no print PDF yet), so every value is
 * checked against the printed label. Its "About" and "Benefits" paragraphs are left out (no
 * health claims), as are the badges' claims.
 */
const LAKE: LabelContent = {
  name: 'Natural Lake Salt',
  nameHindi: 'सफ़ेद नमक',
  brand: 'Pyoor',
  line: 'Extracted from Sambhar Lake',
  summary:
    'The jar’s printed label, unrolled flat: the Pyoor Natural Lake Salt (सफ़ेद नमक) front panel, with the ingredients, nutritional information, storage instructions, the packer’s address and the FSSAI licence number on the right-hand panels.',
  ingredients: 'Natural White Salt',
  nutrition: {
    title: 'Nutritional information',
    note: 'Approximate values, per 100 g (serve size 1 g, 1000 servings per pack)',
    rows: [
      ['Energy', '0 kcal'],
      ['Protein', '0 g'],
      ['Carbohydrate', '0 g'],
      ['Total sugars', '0 g'],
      ['Added sugars', '0 g'],
      ['Total fat', '0 g'],
      ['Sodium', '38.7 g'],
      ['Potassium', '67.86 mg'],
      ['Calcium', '4.48 mg'],
      ['Iron', '0.635 mg'],
      ['Boron', '0.11 mg'],
      ['Zinc', '0.835 mg'],
      ['Folic acid (vitamin B9)', '0.0043 mg'],
      ['Iodine', '2 mg'],
      ['pH of the salt (1% solution)', '>9.00'],
    ],
  },
  netWeight: '1 kg',
  use: '½–1 teaspoon, or as per your requirement.',
  storage: 'Keep in a cool and dry place. Store away from direct heat or sunlight.',
  fssai: '12224999000443',
  packer: LABEL.packer,
  perJar: LABEL.perJar,
  origin: 'Product of India',
  widths: [4096],
  ...front('natural-lake-salt', 1051, 'Natural Lake Salt', 'सफ़ेद नमक'),
};

/**
 * The 1 kg refill pouches: their front and back artwork as two flat sheets (tools/3d/pouch;
 * the back without its temporary barcode). The text panel is the back's text, transcribed
 * from the artwork: it matches the jars' labels, so it reuses them; the back's "About" and
 * "Benefits" paragraphs are left out (no health claims). Checked against the printed pouch.
 */
const pouch = (L: LabelContent, handle: string, sizes: [number, number][]): LabelContent => ({
  ...L,
  summary: SHOW_POUCH_BACK
    ? `The pouch’s printed artwork, front and back, flat: the Pyoor ${L.name} (${L.nameHindi}) 1 kg refill pouch, with the ingredients, nutritional information, storage instructions, the packer’s address and the FSSAI licence number on the back.`
    : `The front of the Pyoor ${L.name} (${L.nameHindi}) 1 kg refill pouch, flat.`,
  sheets: (SHOW_POUCH_BACK ? (['Front', 'Back'] as const) : (['Front'] as const)).map(
    (name, i) => ({
      name,
      src: `/textures/pouch-${handle}-${name.toLowerCase()}.webp`,
      width: sizes[i]![0],
      height: sizes[i]![1],
    }),
  ),
});

/** The labels the reader can show, by product handle (pouches: "<handle>:pouch"). */
/**
 * Pink Rock Salt (behind SHOW_PINK_SALT): its artwork's front panel only, jar and pouch (the
 * rest of its artwork carries claims and an origin the site doesn't state), and a short text
 * panel.
 */
const PINK: LabelContent = {
  name: 'Pink Rock Salt',
  nameHindi: 'सेंधा नमक',
  brand: 'Pyoor',
  line: '',
  summary:
    'The front of the Pyoor Pink Rock Salt (सेंधा नमक) pack, flat, with the name, ingredients, net weight, FSSAI licence and packer as text.',
  ingredients: 'Rock salt (sendha namak)',
  nutrition: null,
  netWeight: '1 kg',
  use: '',
  storage: '',
  fssai: '12224999000443',
  packer: { ...LABEL.packer, title: 'Packed and marketed by' },
  perJar: [],
  origin: '',
  widths: [],
  sheets: [
    { name: 'Front', src: '/textures/label-pink-rock-salt-front.webp', width: 2000, height: 1404 },
  ],
};

export const LABELS: Record<string, LabelContent> = {
  'herbal-black-salt': LABEL,
  'natural-lake-salt': LAKE,
  'herbal-black-salt:pouch': pouch(LABEL, 'herbal-black-salt', [
    [2485, 3297],
    [2500, 3309],
  ]),
  'natural-lake-salt:pouch': pouch(LAKE, 'natural-lake-salt', [
    [2496, 3274],
    [2500, 3309],
  ]),
  'pink-rock-salt': PINK,
  'pink-rock-salt:pouch': {
    ...PINK,
    sheets: [
      {
        name: 'Front',
        src: '/textures/pouch-pink-rock-salt-front.webp',
        width: 2497,
        height: 3622,
      },
    ],
  },
};
