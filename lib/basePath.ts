/**
 * The site's base path: '' locally, '/New-Pyoor' on GitHub Pages (set at build time by
 * NEXT_PUBLIC_BASE_PATH, see next.config.ts). Next adds it to links and its own assets; plain
 * URLs into public/ (fetch, <img>, next/image with `unoptimized`) go through `asset()`.
 */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

export const asset = (path: string) => `${BASE_PATH}${path}`;
