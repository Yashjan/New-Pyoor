import type { MetadataRoute } from 'next';
import { asset } from '@/lib/basePath';
import { getProducts } from '@/lib/commerce';
import { RECIPES } from '@/lib/content/recipes';
import { getSiteUrl } from '@/lib/site';

export const dynamic = 'force-static';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const abs = (p: string) => new URL(asset(p), getSiteUrl()).href;
  const products = await getProducts();
  return [
    { url: abs('/'), changeFrequency: 'weekly', priority: 1 },
    ...products.map((p) => ({ url: abs(`/product/${p.handle}`), priority: 0.8 })),
    { url: abs('/recipes'), changeFrequency: 'monthly', priority: 0.6 },
    ...RECIPES.map((r) => ({
      url: abs(`/recipes/${r.slug}`),
      changeFrequency: 'monthly' as const,
      priority: 0.5,
      images: [abs(`/engravings/recipe-${r.slug}.png`)],
    })),
  ];
}
