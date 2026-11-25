/**
 * The story pages: /our-roots and /the-journey. Engravings: tools/engravings/pages.mjs and the
 * Journey panorama's scenes. Pyoor chooses, checks and packs its salt in its own unit at
 * Sambhar: nothing here says Pyoor makes, harvests or fires salt. No health claims.
 */
export interface ChapterArt {
  /** public/engravings/{name}.svg */
  name: string;
  /** what the engraving shows (its alt text) */
  label: string;
  /** the plate's width / height */
  ratio: string;
}

export interface Chapter {
  id: string;
  title: string;
  body: string[];
  art?: ChapterArt;
}

const WIDE = '640 / 400';
const SCENE = '820 / 512';

export const ROOTS_INTRO = {
  eyebrow: 'Our roots',
  title: 'Born on the shores of Sambhar.',
  lead: 'A lake, an engineer, and his son.',
};

export const ROOTS: Chapter[] = [
  {
    id: 'the-lake',
    title: 'The lake',
    body: [
      'Sambhar is India’s largest inland salt lake, in the heart of Rajasthan. In season its pans turn from white to pink, and in winter the flamingos arrive.',
    ],
    art: {
      name: 'scene-2',
      label: 'Etching: a grid of salt pans reaching to the horizon, salt heaps along it',
      ratio: SCENE,
    },
  },
  {
    id: 'the-engineer',
    title: 'The engineer',
    body: [
      '“My father, Ramlal Jangid, has built salt refineries since 2003, at his company SK Engineering Works: the machines that take salt from the pans and make it pure.”',
    ],
    art: {
      name: 'page-refinery',
      label:
        'Etching: a salt refinery machine, a conveyor carrying salt up to a hopper, a long drum, salt running out into a heap',
      ratio: WIDE,
    },
  },
  {
    id: 'the-son',
    title: 'The son',
    body: [
      '“I grew up around that work, and learned early what separates ordinary salt from good salt. Pyoor is what I made of that.”',
    ],
    art: {
      name: 'page-bench',
      label:
        'Etching: a Pyoor jar on a workbench beside an open notebook, a pencil and a spoon of salt',
      ratio: WIDE,
    },
  },
  {
    id: 'what-we-check',
    title: 'What we check',
    body: [
      '“Our salt is tested in a lab for quality, and every batch is checked before it’s packed. We hold it to the standard my father taught me.”',
    ],
  },
  {
    id: 'packed-at-sambhar',
    title: 'Packed at Sambhar',
    body: [
      'Every jar and pouch is filled and sealed in our unit at Sambhar, and carries its batch.',
    ],
    art: {
      name: 'page-packing',
      label:
        'Etching: jars on a line under a filler, one being filled with salt, one sealed and stamped with its batch',
      ratio: WIDE,
    },
  },
  { id: 'the-letter', title: 'The letter', body: [] },
  {
    id: 'come-and-see',
    title: 'Come and see the lake',
    body: [
      'The pans are at their most beautiful when they turn pink. If you are ever near Sambhar, write to us.',
    ],
    art: {
      name: 'page-horizon',
      label: 'Etching: the lake’s horizon, a half sun setting on it, birds, the light on the water',
      ratio: '640 / 300',
    },
  },
];

/** What we check (our roots 04): three promises. No test results, minerals or percentages. */
export const CHECKS = [
  { icon: 'check-lab', name: 'Lab-tested', text: 'Tested in a lab for quality.' },
  { icon: 'check-batch', name: 'Checked by batch', text: 'Every batch is checked before it’s packed.' },
  { icon: 'check-packed', name: 'Packed at Sambhar', text: 'Filled and sealed in our unit at Sambhar.' },
] as const;

/** The founder's letter (our roots 06), open and signed. */
export const LETTER = {
  place: 'Sambhar Lake, Rajasthan',
  paragraphs: [
    'I grew up on the edge of Sambhar Lake. Every season I watched the pans turn from white to pink, and every year I watched salt from the lake leave in sacks, with no one ever knowing where it came from.',
    'Pyoor is my way of putting a name to it. Every jar is chosen, checked and packed by us at Sambhar.',
    'When you open a jar of Pyoor, you open a little of Sambhar. Thank you for letting it into your kitchen.',
  ],
  byline: 'Yash Jangid, Founder, Pyoor',
  ps: 'P.S. Come and see the lake when the pans turn pink.',
};

export const JOURNEY_INTRO = {
  eyebrow: 'The journey',
  title: 'From the lake to your kitchen.',
  lead: 'How salt is made at Sambhar, and how it reaches you.',
};

export const JOURNEY: Chapter[] = [
  {
    id: 'seasons',
    title: 'The lake in its seasons',
    body: [
      'Sambhar Lake fills with the monsoon and draws back through the dry months. As the water retreats it leaves brine behind, and the salt season begins.',
    ],
    art: {
      name: 'page-horizon',
      label: 'Etching: the lake’s horizon, a half sun on it, birds, the light on the water',
      ratio: '640 / 300',
    },
  },
  {
    id: 'brine',
    title: 'Brine flows into the pans',
    body: [
      'Brine is let in through wooden sluices and led along narrow canals into shallow, rectangular pans laid out across the flats.',
    ],
    art: {
      name: 'scene-1',
      label:
        'Etching at dawn: a wooden sluice lets water into the nearest of many rectangular salt pans',
      ratio: SCENE,
    },
  },
  {
    id: 'sun',
    title: 'The sun does the work',
    body: [
      'Sun and wind draw the water off, day after day. As the brine thickens the pans turn pink, and then the first white crystals form.',
    ],
    art: {
      name: 'scene-2',
      label: 'Etching in the morning: a grid of pans in the sun, salt heaps on the horizon',
      ratio: SCENE,
    },
  },
  {
    id: 'harvest',
    title: 'The harvest',
    body: [
      'When the crust is ready it is raked into long furrows and drawn into rows, by hand.',
    ],
    art: {
      name: 'scene-3',
      label: 'Etching at midday: a figure draws a long rake through the pan beside a salt heap',
      ratio: SCENE,
    },
  },
  {
    id: 'carried',
    title: 'Carried to the heaps',
    body: [
      'Tractors haul the raked salt along the bunds to the great white heaps at the edge of the pans.',
    ],
    art: {
      name: 'scene-4',
      label:
        'Etching in the afternoon: a tractor and trolley piled with salt on the bund road, a worker loading it with a shovel, salt heaps behind',
      ratio: SCENE,
    },
  },
  {
    id: 'heaps',
    title: 'The heaps dry in the sun',
    body: [
      'Piled high beside the pans, the salt drains and dries in the open sun before it moves on.',
    ],
    art: {
      name: 'page-heaps',
      label: 'Etching: white salt heaps in rows, drying under a high sun',
      ratio: WIDE,
    },
  },
  {
    id: 'checked',
    title: 'Chosen and checked',
    body: [
      'Our salt is tested in a lab for quality, and at Pyoor’s unit in Sambhar every batch is checked before it’s packed.',
    ],
    art: {
      name: 'page-checking',
      label: 'Etching: salt crystals spread on a brass tray, a magnifying glass over them',
      ratio: WIDE,
    },
  },
  {
    id: 'packed',
    title: 'Filled, sealed, batch-numbered',
    body: [
      'Every jar and pouch is filled and sealed in Pyoor’s unit at Sambhar, and carries its batch number.',
    ],
    art: {
      name: 'page-packing',
      label:
        'Etching: jars on a line under a filler, one being filled with salt, one sealed and stamped with its batch',
      ratio: WIDE,
    },
  },
  {
    id: 'kitchen',
    title: 'Into your kitchen',
    body: [
      'From the lake to your shelf: a jar for the table, and a pouch to refill it.',
    ],
    art: {
      name: 'page-kitchen',
      label:
        'Etching: a Pyoor jar on a kitchen shelf beside a brass lota, a bowl of lemons and a tin',
      ratio: WIDE,
    },
  },
];

/** The side note on /the-journey: how black salt is made (the fire frames). Neutral. */
export const KALA_NAMAK = {
  title: 'How black salt is made: 32 hours of fire',
  steps: [
    {
      alt: 'White lake salt heaped in a shallow brass vessel',
      text: 'It begins with white lake salt.',
    },
    {
      alt: 'Hands mixing the salt with harad, baheda and amla fruits and strips of babul bark',
      text: 'Harad, baheda and amla, with babul bark, are mixed in by hand.',
    },
    {
      alt: 'A row of round clay pots with sealed mouths set into a low earthen kiln, the bhatti',
      text: 'The salt goes into clay pots, sealed tight, and into the bhatti, a low earthen kiln.',
    },
    {
      alt: 'The bhatti burning, stacked cow-dung cakes around the pots, flames rising',
      text: 'Thirty-two hours of slow, steady fire of cow-dung cakes. Inside the pots the white salt melts and turns black.',
    },
    {
      alt: 'Dark glassy lumps of salt on a cloth, one broken with a stone, ground grains beside it',
      text: 'When it cools it is glassy and dark. Broken and ground, it turns the soft pinkish-brown of kala namak.',
    },
  ],
};
