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

export default nextConfig;
