import { defineConfig } from '@playwright/test';

/** Scroll tests against the production build (next build && next start). Uses the system Chrome. */
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
    command: 'npx next build && npx next start -p 4173',
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
