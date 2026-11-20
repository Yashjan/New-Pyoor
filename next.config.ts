import { PHASE_PRODUCTION_BUILD } from 'next/constants';
import type { NextConfig } from 'next';

/**
 * GitHub Pages (the deploy workflow sets GITHUB_PAGES=1): a static export under the repo's path,
 * e.g. https://yashjan.github.io/New-Pyoor/. Locally and on a Node host nothing changes.
 */
const pages = process.env.GITHUB_PAGES === '1';
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  ...(pages ? { output: 'export', trailingSlash: true, basePath, assetPrefix: basePath } : {}),
  images: {
    formats: ['image/avif', 'image/webp'],
    // a static host has no image optimiser: the files are served as they are
    unoptimized: pages,
  },
  // (a static host ignores custom headers; GitHub Pages sets its own caching)
  ...(pages
    ? {}
    : {
        async headers() {
          return [
            {
              // Compressed jar models: modelUrl() (lib/three/models.ts) adds a content hash to
              // every URL, so a rebuilt model gets a new URL and this cache can be immutable.
              source: '/models/:file*',
              headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
            },
          ];
        },
      }),
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
