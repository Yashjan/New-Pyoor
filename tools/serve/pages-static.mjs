// Serves out/ the way Cloudflare Pages serves a static site, for machines where `wrangler pages
// dev` can't run (its runtime, workerd, needs glibc 2.35+). Static only: /api/* answers 501.
// Pages rules followed: /x → x.html or x/index.html, a trailing slash redirects to the bare path,
// misses get 404.html with status 404, and public/_headers is applied.
// Usage: node tools/serve/pages-static.mjs [port]
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';

const ROOT = join(process.cwd(), 'out');
const PORT = Number(process.argv[2] ?? 4173);
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.glb': 'model/gltf-binary',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.webm': 'video/webm',
  '.mp4': 'video/mp4',
  '.webmanifest': 'application/manifest+json',
  '.wasm': 'application/wasm',
  '.ktx2': 'image/ktx2',
  '.bin': 'application/octet-stream',
};

// _headers: "/path" lines followed by indented "Name: value" lines; "*" matches anything
const RULES = [];
for (const line of readFileSync(join(ROOT, '_headers'), 'utf8').split('\n')) {
  if (!line.trim() || line.trim().startsWith('#')) continue;
  if (!/^\s/.test(line)) {
    const re = new RegExp(
      '^' +
        line
          .trim()
          .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
          .replace(/\*/g, '.*') +
        '$',
    );
    RULES.push({ re, headers: [] });
  } else RULES.at(-1)?.headers.push(line.trim().split(/:\s*/, 2));
}

const file = (p) => (existsSync(p) && statSync(p).isFile() ? p : null);

createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  const path = decodeURIComponent(url.pathname);
  if (path.startsWith('/api/'))
    return res
      .writeHead(501, { 'content-type': 'application/json' })
      .end('{"error":"functions need wrangler"}');
  if (path.length > 1 && path.endsWith('/'))
    return res.writeHead(308, { location: path.slice(0, -1) + url.search }).end();
  const base = normalize(join(ROOT, path));
  if (!base.startsWith(ROOT)) return res.writeHead(403).end();
  const hit = file(base) ?? file(base + '.html') ?? file(join(base, 'index.html'));
  const target = hit ?? join(ROOT, '404.html');
  const headers = { 'content-type': TYPES[extname(target)] ?? 'application/octet-stream' };
  for (const r of RULES)
    if (r.re.test(path)) for (const [k, v] of r.headers) headers[k.toLowerCase()] = v;
  res.writeHead(hit ? 200 : 404, headers);
  createReadStream(target).pipe(res);
}).listen(PORT, () => console.log(`out/ on http://localhost:${PORT}`));
