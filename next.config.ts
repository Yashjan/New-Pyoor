import { PHASE_PRODUCTION_BUILD } from 'next/constants';
import type { NextConfig } from 'next';

/**
 * A static export (out/): every page, OG image, sitemap, robots and manifest is rendered at build
 * time and served by Cloudflare Pages; the backend is Pages Functions (functions/). Response
 * headers (the models' long cache) are in public/_headers.
 */
const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  output: 'export',
  images: {
    // a static host has no image optimiser: the files are served as they are
    unoptimized: true,
  },
};

/**
 * A production build must know the live address (canonical URLs, Open Graph, JSON-LD, sitemap,
 * robots: lib/site.ts getSiteUrl). .env.production sets it; a missing or localhost value fails
 * the build rather than shipping links to localhost.
 */
export default function config(phase: string): NextConfig {
  if (phase === PHASE_PRODUCTION_BUILD) {
    const url = process.env.NEXT_PUBLIC_SITE_URL ?? '';
    if (!url || /localhost|127\.0\.0\.1/.test(url))
      throw new Error(
        `NEXT_PUBLIC_SITE_URL must be the live site's address for a production build (got "${url}"). Set it in .env.production.`,
      );
  }
  return nextConfig;
}
