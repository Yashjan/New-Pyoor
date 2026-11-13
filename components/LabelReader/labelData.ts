/**
 * The Herbal Black Salt label as text (the label reader's accessible content), read from the
 * label artwork (tools/3d/source/labels/label-herbal-black-salt.pdf; its text is outlined, so
 * it was transcribed, not extracted). Values are as printed; anything not printed, or worth a
 * second look, is marked [CONFIRM]. The label's "About" and "Benefits" paragraphs are left out
 * on purpose: the site makes no health claims.
 */
export const LABEL = {
  name: 'Herbal Black Salt',
  nameHindi: 'काला नमक',
  brand: 'Pyoor',
  line: 'Created from Sambhar Lake salt',
  summary:
    'The jar’s printed label, unrolled flat: the Pyoor Herbal Black Salt (काला नमक) front panel, with the ingredients, nutritional information, storage instructions, the packer’s address and the FSSAI licence number on the right-hand panels.',
  ingredients: 'Herbal Black Salt (Amla + Harad + Baheda)',
  nutrition: {
    title: 'Nutritional information',
    note: 'Approximate values, per 100 g',
    rows: [
      ['Energy', '0 kcal'],
      ['Sodium', '38.90 g'],
      ['Triphala content (Amla + Harad + Baheda)', 'Positive'],
      ['Chloride content (as NaCl)', '98.90%'],
      ['Potassium', '0.02 g [CONFIRM: printed “0.02 gm”]'],
      ['Magnesium (as Mg)', '0.01%'],
      ['Iron', '90 ppm'],
    ] as const,
  },
  netWeight: '1 kg',
  use: '½–1 teaspoon, or as per your requirement.',
  storage: 'Keep in a cool and dry place. Store away from direct heat or sunlight.',
  fssai: '12224999000443',
  packer: {
    title: 'Packed and marketed by',
    name: 'Pyoor Global Enterprises',
    address: ['58-R, Shiv Vihar Colony, Phulera Road', 'Sambhar Lake, Jaipur, Rajasthan 303604'],
    phone: '+91 75976 15660',
    email: 'pyoorglobalenterprises@gmail.com',
    web: 'www.pyoorglobal.com',
  },
  /** printed blank on the label and filled in per batch */
  perJar: [
    ['Batch no.', '[BATCH]'],
    ['Packed on', '[DATE] (printed “Date of Mfg”)'],
    ['Best before', '[DATE] [CONFIRM: the label prints “Use By”; shelf life not stated]'],
    ['MRP', '[PRICE] (incl. of all taxes)'],
  ] as const,
  origin: 'Product of India',
} as const;
