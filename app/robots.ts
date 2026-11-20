import type { MetadataRoute } from 'next';
import { asset } from '@/lib/basePath';
import { getSiteUrl } from '@/lib/site';

export const dynamic = 'force-static';

export default function robots(): MetadataRoute.Robots {
  const base = getSiteUrl();
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/dev/'] }],
    sitemap: new URL(asset('/sitemap.xml'), base).href,
    host: base.origin,
  };
}
