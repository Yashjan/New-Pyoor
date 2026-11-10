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
  layout.tsx             fonts (next/font), metadata, the `html.motion` flag, header/footer/bag
  globals.css            reset, base type, focus ring, Lenis rules, shared `py-` type utilities
  page.tsx               homepage
  product/[handle]/      product page (skeleton until Step 4; one static page per product)
components/              one folder per component, each with a .module.css
  Button/ Horizon/ Placeholder/ ProductFeature/ SiteHeader/   design-system components
  SplitText/ HindiText/  headings split into word masks; Devanagari words
  CartDrawer/ BagToast/  the bag (native <dialog>) and the "Added to bag" toast
  Footer/                navy footer, logo on the ivory crest, newsletter
  sections/              Roots, Journey, Salts, Crystals, Recipes
  hero/JarHero.tsx       the pinned 3D hero (copy, poster, beats, rail)
  hero/scene/            the 3D logic, all pure functions of scroll progress (see below)
  motion/                SmoothScroll (Lenis ↔ ScrollTrigger), HomeMotion (page choreography)
  providers/             CartProvider
lib/
  site.ts                company facts, FSSAI disclaimer (single source)
  format.ts              price formatting (₹, or "Price coming soon")
  commerce/              the commerce layer (see below)
  three/                 quality tiers, GLTF + Meshopt loader, dispose helpers
  motion/                lazy GSAP loader, Lenis store + anchor scrolling
styles/tokens.css        design tokens, ported from docs/design-handoff/design-system/tokens.json
public/
  models/                compressed jar models served to the browser (generated)
  brand/                 pyoor-logo.png (green master, used), original SVG; gold/ivory PNGs are
                         legacy recolours and must not be used (brand book §6)
  images/renders/        transparent jar renders from the 3D models (poster, product features)
  images/textures/       crystals.jpg (navy crystals section)
docs/design-handoff/     the approved design: HANDOFF.md, design-system/, hero-reference/
docs/images/             review screenshots (hero stages, compression before/after)
tools/3d/                3D asset pipeline (not shipped)
```

## Design system

The approved system is in [`docs/design-handoff/design-system/`](docs/design-handoff/design-system/):
"Label True" palette (ivory ground, navy ink, one gold thread; green only in the logo) and Cormorant
Garamond / Manrope / Tiro Devanagari Hindi. Read its `README.md` (the brand book) before changing UI.

- [`styles/tokens.css`](styles/tokens.css) mirrors `tokens.json` exactly: raw palette, semantic tokens
  for the ivory default and `[data-theme="navy"]` overrides, type styles, spacing, radius, layout,
  timing. Change `tokens.json` first, then mirror it. The only additions are the prototype's fluid
  display ramp (`--d-xl`, `--d-l`, `--d-m`).
- Put `data-theme="navy"` on a section and every semantic token flips (Crystals, footer, mobile menu).
- Cormorant never below 28px; prices always Manrope 600 tabular; small gold text uses
  `--accent-text` (gold-500 is only 3.1:1 on ivory).
- One primary button per screen; unpriced products get a disabled "Price coming soon" button.

## The 3D hero

`components/hero/JarHero.tsx` + `components/hero/scene/`, ported from
`docs/design-handoff/hero-reference/concept.html`. The hero section is 520vh tall with a sticky
stage; scroll progress p (0–1) drives everything.

| p         | What happens                                                                |
| --------- | --------------------------------------------------------------------------- |
| 0 – .14   | jar floats with a slow turn (pointer parallax); headline fades out from .03 |
| .05 – .24 | lid unscrews 1.5 turns while rising, then flies up and away                 |
| .24 – .42 | jar tips ~113° around its bottom-left edge; the camera follows              |
| .44 – .76 | ~6,000 precomputed crystals pour into a heap; the salt surface sinks        |
| .74 – .86 | jar rises out of frame                                                      |
| .76 – .97 | heap spreads, salt-crust plane fades in, gold horizon line, "Sambhar Lake"  |

| File                      | Role                                                                           |
| ------------------------- | ------------------------------------------------------------------------------ |
| `scene/jar.ts`            | `createJarRig()` (pivot → jar → lid groups), `setJar()` tilt pose, `poseJar()` |
| `scene/camera.ts`         | the `K` camera keyframes and `cameraAt(p)`                                     |
| `scene/grains.ts`         | `buildGrains()` (seeded paths, once) and `updateGrains(p)` (InstancedMesh)     |
| `scene/ground.ts`         | `crustTexture()` salt flats, soft shadow floor, gold horizon mesh              |
| `scene/createJarScene.ts` | renderer, lights, loop, resize, visibility pause, dispose                      |
| `lib/three/quality.ts`    | tiers: 6,000 grains desktop / 2,800 phones / 1,500 weak devices                |

- **Deterministic.** No physics and no state carried between frames: each grain's path is computed
  once from a seeded RNG, and every frame is a function of p. The scene eases towards the scroll
  position and then snaps exactly onto it, so the same scroll position always gives the same frame
  (verified pixel-for-pixel scrolling forwards and back). Only the idle float and pointer parallax
  (p < .14) depend on time; `?heroStill` freezes them for screenshots.
- **Relative motion.** meshopt quantization gives every node a base transform; the rig uses
  `attach()` and offsets (e.g. `Salt_top` y) so those transforms are preserved.
- **Loading.** The headline and buttons are server-rendered; three.js and the model are imported
  after the page is idle, and the poster (`images/renders/jar-black.webp`) shows until the first
  3D frame. Rendering pauses while the hero is off-screen; everything is disposed on unmount.
- **The text beats and rail** are a GSAP timeline scrubbed by the same progress (`HomeMotion`).

## Motion and reduced motion

- `app/layout.tsx` adds `html.motion` before first paint when JS runs and the visitor hasn't asked
  for reduced motion. CSS keys the pinned hero and the horizontal Journey on that class. Without it
  (no JS, or reduced motion) there is no WebGL, no smooth scroll and no scrubbing: the hero is one
  static screen with the poster, its three beats stack below, and Journey is a plain list.
- Lenis runs on GSAP's ticker and feeds ScrollTrigger (`SmoothScroll`). Same-page links (`/#shop`)
  are intercepted in the capture phase and scrolled by Lenis.
- `HomeMotion` handles the rest: heading word reveals (`[data-split]`), `[data-fade]`,
  `[data-draw]` (horizon), `[data-parallax]`, `[data-float]`, `[data-clip-reveal]`, the crystals
  zoom and the pinned Journey (≥ 861px). Content is visible in the server HTML; tweens only start
  from hidden states once GSAP has loaded.
- **Do not use `content-visibility: auto` on page sections**: ScrollTrigger then measures
  placeholder heights and triggers misfire (tested in Step 2).

## 3D models

The jars are glTF 2.0 binaries in metres, Y up, label front facing +Z; 12.2 cm tall, 10 cm across.
Nodes: `Body` (clear PET), `Salt`, `Salt_top`, `Label`, `Lid` (smoky PET), `Lid_rim`.

### Compress (after any change to `tools/3d/source/`)

```bash
npm run models
```

Per jar: name textures → `dedup` → `prune` → resize the salt normal + roughness maps to 512 px →
WebP (normal map q90, others q80) → meshopt. Result: **423–551 KB per jar** (from 1.5–2.0 MB), budget 600 KB. The black salt jar keeps its 1024 px
normal map (`FULL_NORMAL` in `compress.sh`) because the hero shows it up close.
The script fails if `KHR_materials_transmission`, `KHR_materials_ior` or `KHR_materials_volume` go missing.

Decisions:

- **WebP, not KTX2.** KTX2 needs the Basis transcoder (~200 KB) on the client, which would blow the hero JS budget.
- **No `gltf-transform optimize`.** Its join/flatten steps merge nodes; the hero animates each node separately.
- **meshopt quantization adds a translation + uniform scale to every node** (the mesh is stored in a
  unit volume). Animation code must therefore apply offsets _relative to each node's loaded transform_
  rather than overwriting `position`/`scale`. `thicknessFactor` on the PET materials is rescaled by
  gltf-transform to match, so the world-space thickness is unchanged.
- Decoding requires `MeshoptDecoder` (`three/examples/jsm/libs/meshopt_decoder.module.js`) on the GLTFLoader.

Hero stage screenshots: [`docs/images/hero-stages-desktop.jpg`](docs/images/hero-stages-desktop.jpg),
[`docs/images/hero-stages-mobile.jpg`](docs/images/hero-stages-mobile.jpg).

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
| `pricing.ts`       | **Prices and the free-shipping threshold: the one place to fill them in.** `null` means not set yet.                                                                   |
| `local-data.ts`    | Product data. Himalayan Pink Salt is kept with `published: false` (never listed or routable).                                                                          |
| `local-catalog.ts` | `CatalogProvider` over `local-data.ts`.                                                                                                                                |
| `local-cart.ts`    | `CartProvider` over `localStorage` (stores only variant id + qty; prices re-resolved on read).                                                                         |
| `index.ts`         | Picks the providers and re-exports the API.                                                                                                                            |

A `null` price shows a disabled **Price coming soon** button instead of Add to bag: unpriced items
never enter the bag (`isPurchasable` in `types.ts`, enforced again in `local-cart.ts`). The
free-shipping threshold (`getFreeShippingThreshold()`) is kept for checkout; the premium design has
no announcement bar to show it in.

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
