/**
 * Site-wide facts and copy that appear in more than one place (header, footer, metadata,
 * JSON-LD). Keep this file factual: no health, medicinal or nutritional claims.
 * Values in [BRACKETS] are placeholders awaiting confirmation from the business.
 */

export const site = {
  name: 'Pyoor',
  tagline: 'Salt, the way the lake makes it.',
  description:
    'Salt from Sambhar Lake, Rajasthan. Herbal black salt and natural lake salt, packed at the source in 1 kg jars.',
  company: {
    legalName: 'Pyoor Global Enterprises',
    address: {
      street: '58-R Shiv Vihar Colony, Phulera Road',
      locality: 'Sambhar Lake',
      region: 'Jaipur, Rajasthan',
      postalCode: '303604',
      country: 'IN',
    },
    phone: '+91 75976 15660',
    email: 'pyoorglobalenterprises@gmail.com',
    fssaiLicence: '12224999000443',
  },
  /** Required by FSSAI for brand names that sound like "pure". Must appear in the footer. */
  brandNameDisclaimer:
    '“Pyoor” is only a brand name and does not represent the true nature of the product.',
  nav: [
    { label: 'Shop', href: '/#shop' },
    { label: 'Sambhar Lake', href: '/#origin' },
    { label: 'Our Process', href: '/#process' },
    { label: 'Recipes', href: '/#recipes' },
  ],
} as const;

/** Absolute site URL for canonical links, Open Graph, sitemap and JSON-LD. */
export function getSiteUrl(): URL {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return new URL(explicit);
  const vercel = process.env.VERCEL_URL;
  if (vercel) return new URL(`https://${vercel}`);
  return new URL('http://localhost:3000');
}
