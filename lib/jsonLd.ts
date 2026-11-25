import type { Product } from '@/lib/commerce';
import { getSiteUrl, site } from '@/lib/site';

/** An absolute URL for a site path (base path included). */
export const absUrl = (path: string) => new URL(path, getSiteUrl()).href;

/** The JSON for a <script type="application/ld+json">, safe to inline. */
export const ldScript = (data: object) => JSON.stringify(data).replace(/</g, '\\u003c');

export function organizationLd() {
  const { company } = site;
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': absUrl('/#organization'),
    name: site.name,
    legalName: company.legalName,
    url: absUrl('/'),
    logo: absUrl('/brand/pyoor-logo.png'),
    email: company.email,
    sameAs: [site.instagram],
    address: {
      '@type': 'PostalAddress',
      streetAddress: company.address.street,
      addressLocality: company.address.locality,
      addressRegion: company.address.region,
      postalCode: company.address.postalCode,
      addressCountry: company.address.country,
    },
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer service',
      telephone: site.whatsapp.label.replace(/\s/g, ''),
      url: site.whatsapp.url,
      availableLanguage: ['en', 'hi'],
    },
  };
}

export function productLd(p: Product) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.title,
    description: p.description,
    image: p.images.map((i) => new URL(i.url, getSiteUrl()).href),
    brand: { '@type': 'Brand', name: site.name },
    url: absUrl(`/product/${p.handle}`),
    offers: p.variants
      .filter((v) => v.price)
      .map((v) => ({
        '@type': 'Offer',
        sku: v.sku,
        name: v.title,
        price: v.price!.amount.toFixed(2),
        priceCurrency: 'INR',
        availability: v.availableForSale
          ? 'https://schema.org/InStock'
          : 'https://schema.org/OutOfStock',
        url: absUrl(`/product/${p.handle}`),
      })),
  };
}
