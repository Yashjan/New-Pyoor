# Pyoor: website

Storefront for **Pyoor**, salt from Sambhar Lake, Rajasthan
(Pyoor Global Enterprises · FSSAI Lic. No. 12224999000443).

Next.js (App Router) · TypeScript (strict) · CSS Modules + CSS variables · three.js · GSAP + ScrollTrigger · Lenis.
Deploys to Vercel.

---

## Setup

Requirements: **Node 20.9+** (see `.nvmrc`), npm 10.
For rebuilding the 3D models from scratch (rarely needed): Python 3.8+ with `numpy pillow pygltflib`.

```bash
npm install
cp .env.example .env.local   # optional locally; defaults work
npm run dev                  # http://localhost:3000
```

## Scripts

| Script                   | What it does                                                          |
| ------------------------ | --------------------------------------------------------------------- |
| `npm run dev`            | Dev server (Turbopack)                                                |
| `npm run build`          | Production build (also type-checks)                                   |
| `npm start`              | Serve the production build                                            |
| `npm run lint`           | ESLint (Next core-web-vitals + TypeScript rules, Prettier-compatible) |
| `npm run typecheck`      | `tsc --noEmit`                                                        |
| `npm run format`         | Prettier write (`format:check` to verify only)                        |
| `npm run models`         | Compress `tools/3d/source/*.glb` → `public/models/`                   |
| `npm run models:inspect` | Print extensions, meshes and texture sizes of the compressed models   |

## Folder structure

```
app/                     routes (App Router)
  layout.tsx             fonts (next/font), global metadata, skip link
  globals.css            reset, base typography, focus styles, utilities; imports tokens
  page.tsx               homepage
  product/[handle]/      product detail page (static, one per published product)
components/              UI components, one folder each with a .module.css   (Step 2)
  hero/                  JarHero: three.js scene + scroll timeline            (Step 3)
lib/
  site.ts                company facts, nav, announcement, FSSAI disclaimer (single source)
  format.ts              price formatting (₹, or the "[PRICE]" placeholder)
  commerce/              the commerce layer (see below)
  three/                 three.js loaders, quality tiers, helpers               (Step 3)
styles/tokens.css        design tokens: colours, type scale, spacing, motion, z-index
public/
  models/                compressed jar models served to the browser (generated)
  brand/                 logos (gold for navy backgrounds, ivory, original SVG)
  images/                product photos
tools/3d/                3D asset pipeline (not shipped)
  source/                original uncompressed jar models (the source of truth)
  textures/              label artwork + salt crystal textures
  build_jar.py           rebuilds source/*.glb from textures
  crystal_tex.py         regenerates the salt crystal textures
  name_textures.py       names glTF images by material slot (used by compress.sh)
  compress.sh            the compression pipeline (`npm run models`)
docs/images/             review material (e.g. compression before/after renders)
```

## Design tokens

All colours, type sizes, spacing and timings live in [`styles/tokens.css`](styles/tokens.css) as CSS
custom properties; components use semantic tokens (`--text-on-dark`, `--accent-on-light` …) rather
than raw palette values. Measured contrast ratios are in the file header. **Gold `#D8B46A` is not
legible on ivory (1.75:1); use `--color-gold-dark` for text on light surfaces.**

Fonts are self-hosted at build time with `next/font/google`: Cormorant Garamond (display), Manrope
(body), Tiro Devanagari Hindi (Hindi accents, not preloaded).

## 3D models

The jars are glTF 2.0 binaries in metres, Y up, label front facing +Z; 12.2 cm tall, 10 cm across.
Nodes: `Body` (clear PET), `Salt`, `Salt_top`, `Label`, `Lid` (smoky PET), `Lid_rim`.

### Compress (after any change to `tools/3d/source/`)

```bash
npm run models
```

Per jar: name textures → `dedup` → `prune` → resize the salt normal + roughness maps to 512 px →
WebP (normal map q90, others q80) → meshopt. Result: **~420–485 KB per jar** (from 1.5–2.0 MB), budget 600 KB.
The script fails if `KHR_materials_transmission`, `KHR_materials_ior` or `KHR_materials_volume` go missing.

Decisions:

- **WebP, not KTX2.** KTX2 needs the Basis transcoder (~200 KB) on the client, which would blow the hero JS budget.
- **No `gltf-transform optimize`.** Its join/flatten steps merge nodes; the hero animates each node separately.
- **meshopt quantization adds a translation + uniform scale to every node** (the mesh is stored in a
  unit volume). Animation code must therefore apply offsets _relative to each node's loaded transform_
  rather than overwriting `position`/`scale`. `thicknessFactor` on the PET materials is rescaled by
  gltf-transform to match, so the world-space thickness is unchanged.
- Decoding requires `MeshoptDecoder` (`three/examples/jsm/libs/meshopt_decoder.module.js`) on the GLTFLoader.

Before/after render (three.js, same lighting): [`docs/images/model-compression-before-after.jpg`](docs/images/model-compression-before-after.jpg).

### Rebuild the source models (only when labels or textures change)

```bash
pip install numpy pillow pygltflib
python3 tools/3d/crystal_tex.py      # only if the salt textures should change
python3 tools/3d/build_jar.py        # writes tools/3d/source/*.glb
npm run models                       # then compress
```

To change a label, replace `tools/3d/textures/label-*.png` and rerun `build_jar.py`.

## Commerce layer

Everything commerce-related goes through [`lib/commerce/index.ts`](lib/commerce/index.ts). App code
imports only from `@/lib/commerce`:

```ts
getProducts();
getProduct(handle); // catalogue (server-safe)
getCart();
addToCart(variantId, qty);
updateCartLine(lineId, qty);
removeFromCart(lineId);
```

| File               | Role                                                                                                                                                                   |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `types.ts`         | Backend-agnostic types (`Product`, `ProductVariant`, `Cart`, `Money` …) and the `CatalogProvider` / `CartProvider` interfaces. Shapes mirror Shopify's Storefront API. |
| `local-data.ts`    | Product data. Himalayan Pink Salt is kept with `published: false` (never listed or routable).                                                                          |
| `local-catalog.ts` | `CatalogProvider` over `local-data.ts`.                                                                                                                                |
| `local-cart.ts`    | `CartProvider` over `localStorage` (stores only variant id + qty; prices re-resolved on read).                                                                         |
| `index.ts`         | Picks the providers and re-exports the API.                                                                                                                            |

Prices are `Money | null`; `null` renders as **₹[PRICE]** until confirmed.

### Switching to Shopify (later)

1. Add `shopify-catalog.ts` implementing `CatalogProvider` with Storefront API queries
   (`products`, `productByHandle`), mapping `MoneyV2.amount` (string) → `number`.
2. Add `shopify-cart.ts` implementing `CartProvider` with the Cart API (`cartCreate`,
   `cartLinesAdd`, `cartLinesUpdate`, `cartLinesRemove`); store the cart id instead of lines.
   `checkoutUrl` comes from the cart; Razorpay and COD are configured in Shopify checkout.
3. In `index.ts`, swap `localCatalog` / `localCart` for the Shopify providers.
4. Fill in the `SHOPIFY_*` variables (see `.env.example`).

No file outside `lib/commerce/` changes.

## Content rules

Factual copy only: origin, ingredients, process, size, price, taste, use. **No health, medicinal or
nutritional claims** (e.g. "aids digestion", "detox", "84 minerals", "100% natural", "chemical free").
No invented reviews, stats or awards; unknown values use visible `[PLACEHOLDERS]`.
The footer must carry: _“Pyoor” is only a brand name and does not represent the true nature of the product._
(text lives in `lib/site.ts`).

Note: the current printed labels (and therefore the product photos and 3D label textures) still
show old claims; they will change when the labels are reprinted. Website copy must not repeat them.

## Deploy (Vercel)

1. Import the GitHub repo in Vercel; framework preset **Next.js**, no build overrides needed.
2. Set `NEXT_PUBLIC_SITE_URL` for Production (e.g. `https://pyoor.in`). Previews fall back to `VERCEL_URL`.
3. Every push to a branch gets a preview URL; `main` deploys to production.

CLI alternative: `npx vercel` (preview) / `npx vercel --prod`.
