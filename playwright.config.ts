import { defineConfig } from '@playwright/test';

/**
 * The browser suite against the Cloudflare build: the static export (out/) and the Functions with a
 * local D1, served by wrangler pages dev. Uses the system Chrome.
 */
export default defineConfig({
  testDir: 'tests',
  timeout: 90_000,
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:4173',
    channel: 'chrome',
    // the machine's GPU, as visitors have (software GL takes seconds per 3D frame)
    launchOptions: {
      args: ['--use-gl=angle', '--use-angle=gl-egl', '--ignore-gpu-blocklist', '--enable-gpu'],
    },
  },
  webServer: {
    // PW_STATIC=1: out/ through tools/serve/pages-static.mjs where wrangler's runtime can't run
    // (it needs glibc 2.35+); the API is then covered by the unit tests (npm run test:unit)
    command: process.env.PW_STATIC
      ? 'npx next build && node tools/serve/pages-static.mjs 4173'
      : 'npx next build && npm run db:local && npx wrangler pages dev out --port 4173',
    url: 'http://localhost:4173',
    timeout: 300_000,
    reuseExistingServer: false,
  },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1440, height: 900 } } },
    {
      name: 'phone',
      use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
    },
  ],
});
