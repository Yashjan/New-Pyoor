# Pyoor pre-launch audit · 2026-11-19

Production build on :3001, Chrome (system, GPU). Check only, no code changed.
Raw data: `visual.json`, `function.json`, `perf.json`, `lighthouse-{mobile,desktop}.json`, `content-scan.txt`, `sizes.txt`.
Contact sheets: `sheet-1440.jpg`, `sheet-1280.jpg`, `sheet-768.jpg`, `sheet-390.jpg`, `sheet-375.jpg`, `sheet-reduced-motion.jpg`. Every screenshot is in `shots/`.

## Summary

| # | Sev | Issue | Where | Shot | Suggested fix |
|---|-----|-------|-------|------|---------------|
| 1 | Blocker | Jar label artwork shows health claims ("aiding digestion, reducing bloating", "Reduces Heartburn", "antacid", "boosts immunity", "54 minerals", "chemical-free", "Self Iodized") | Label reader, 3D jars, all sizes | [label-jar](shots/1440-042-label-jar.jpg), [lake](shots/1440-044-label-pouch.jpg) | Use corrected label textures (left panels blanked) before launch |
| 2 | Blocker | Pink Rock Salt jar and pouch read "HIMALAYAN PINK SALT" and "84 TRACE MINERALS"; the model file is named `pyoor-himalayan-pink-salt.glb` | Products, pink plate, all sizes | [pink](shots/1440-019-home-y13770.jpg) | New pink artwork without "Himalayan" or mineral counts; rename the file |
| 3 | Blocker | Canonical, OG, JSON-LD and sitemap URLs all point to `http://localhost:3000` | Every page | function.json → seo | Set `NEXT_PUBLIC_SITE_URL` to the live domain at build time |
| 4 | High | Footer links Shipping, Returns, FAQ, Privacy and Terms return 404 | Footer, every page | — | Write the pages, or hide the links until they exist |
| 5 | High | 404 page is Next's default: white page, no `<main>`, not on-brand | /any-missing-url | [404](shots/1440-039-page-nope-404.jpg) | Add `app/not-found.tsx` in the site's style |
| 6 | High | Mobile Lighthouse performance 57: TBT 11.5 s, LCP 3.8 s. Desktop 69 (TBT 2.4 s) | Homepage | lighthouse-mobile.json | Defer the three.js and opening work until after first paint; split the 148 KB chunk |
| 7 | High | Scroll jank: 14–21 fps at y≈11,000–11,500 (pans / the lake opens); long tasks up to 1.7 s while scrolling. With 4× CPU: median 36 fps, as low as 6 fps | Homepage, 1440 | perf.json | Profile the pans/lake transition; spread model warm-up across idle time |
| 8 | High | Placeholders users can see: "[BATCH]", "[CONFIRM: printed “0.02 gm”]", "Self iodized (as printed) [CONFIRM]", "[DATE]" | Label reader text panel | [label-jar](shots/1440-042-label-jar.jpg) | Fill in the values or remove the rows |
| 9 | High | Fire frame 4 renders as a broken image (its alt text shows) when reduced motion is on | Fire, reduced motion | [rm](sheet-reduced-motion.jpg) | Check the frame-4 `<img>` src and loading in the still layout |
| 10 | Medium | Firefox and WebKit not tested: Playwright doesn't support them on Ubuntu 20.04 | Browsers | — | Run section 2 on a Mac or in CI (Ubuntu 22.04+), or with BrowserStack |
| 11 | Medium | No robots.txt, no favicon.ico, no web manifest | Site root | — | Add `app/robots.ts` (with the sitemap) and a favicon.ico |
| 12 | Medium | No Open Graph or Twitter image on the homepage and product pages (only recipe pages have one); no canonical on / or the product pages | SEO | function.json → seo | Add an OG image per page and `alternates.canonical` |
| 13 | Medium | Two different phone numbers: +91 75976 15660 (footer, label) and +91 76650 09882 (WhatsApp) | Site-wide | — | Confirm both are intended |
| 14 | Medium | The lake salt's Hindi name differs: plate says "सांभर नमक", product page and label say "सफ़ेद नमक" | Products vs product page | [plate](shots/1440-044-label-pouch.jpg) | Pick one name everywhere |
| 15 | Medium | axe (serious): `aria-label` on the Look closer field `<div>`, which has no role | Homepage, Crystals | function.json → axe | Add `role="application"` or `role="img"`, or move the label |
| 16 | Low | axe: heading order skips on the Pink Rock Salt plate (`#plate-pink-rock-salt`) | Products | — | Use h2 or h3 consistently |
| 17 | Low | Text at 11px: footer column titles, recipe "Serves/Time/Salt" labels | Footer, recipe page, all sizes | [footer](shots/375-031-home-y17400.jpg) | Raise to 0.75rem (12px) |
| 18 | Low | Console warnings: THREE.Clock deprecated, PCFSoftShadowMap removed, "Too many active WebGL contexts"; logo preloaded but not used (768) | All sizes | visual.json | Use THREE.Timer and PCFShadowMap; dispose idle contexts |
| 19 | Low | Lake opens / letter frames are mostly empty mid-transition (>25% blank) | Homepage, 1440 | [env](shots/1440-027-home-y20250.jpg) | Intentional? Consider shortening those stretches |
| 20 | Low | Homepage has a section labelled "The Pair" although the Pair is hidden | Homepage markup | — | Rename the aria-label or remove the wrapper |

## Details

### 1. Visual pass
Homepage captured every 0.9 viewport heights, plus /recipes, a recipe page, a product page, the 404 page, the menu, the bag (4 items) and the label reader, at 5 sizes: 228 shots. Automatic checks:
- No horizontal overflow at any size.
- Text under 12px only in the footer column titles and the recipe fact labels (11px).

Seen on the sheets:
- **Problems:** issues 1, 2, 5, 9 and 19.
- **Fine:** the hero, Journey 01–04, the jar film, the pans, the products, the fire hours, Look closer, the letter, recipes and the footer render as designed at all sizes.
- **Colour:** no navy rendering violet and no wrong gold found.
- **Label reader capture:** the shot taken during the label reader's open animation ([label-pouch](shots/1440-044-label-pouch.jpg)) shows the strip mid-flight over the page. It was captured during the transition, so recheck it by hand.

### 2. Browsers
Only Chromium was tested: Playwright can't install Firefox or WebKit on Ubuntu 20.04. In Chromium the full flow works: load, footer and back, menu, jar + pouch into the bag, label reader, recipe page. The only console error is the expected 404 resource.

### 3. Function
**Links**
- All internal links return 200, apart from the five help pages (#4).
- The `/#top` link has no element with id `top`. Back to the lake scrolls to the top anyway because it's handled in JS.
- WhatsApp → wa.me/917665009882 and Instagram → instagram.com/pyoorglobal.

**Bag**
- Black and lake salt, jar and pouch, all added: ₹199 / ₹149, subtotal ₹696.
- + changes the line to ₹398 and the subtotal to ₹895.
- Remove works (₹497), and the bag is the same after a reload.
- Pink Rock Salt can only be added from its homepage plate; I didn't test that line or the drawer's refill line.

**Label reader**
- Opens with Enter, and the text panel scrolls with the wheel (0 → 309 px).
- Zoom and pan respond (`fn-label-zoom.jpg`, `fn-label-pan.jpg`).
- Esc closes it and focus returns to "Read the label".

**Drag-to-rotate**
- The automated drag shots captured the wrong element, so this is inconclusive and needs a manual check.
- The pouch back texture was never requested: 0 "back" requests.

**Sound**
- Off by default; no audio file is requested before the toggle.
- Turning it on loads 6 loops/one-shots. Whether each sound plays exactly once wasn't verified.

**Reload and history**
- Reload at y=10,172 starts at 0.
- Back and Forward between / and /recipes both work.

### 4. Performance
| | Lighthouse perf | LCP | CLS | TBT | Transfer |
|---|---|---|---|---|---|
| Mobile | 57 | 3.8 s | 0 | 11.5 s | 1.93 MB |
| Desktop | 69 | 0.8 s | 0 | 2.4 s | 1.93 MB |

- **JavaScript:** 1.64 MB raw / 483 KB gzip in total; the largest chunk is 605 KB raw / 150 KB gzip (three.js).
- **Largest files:**
  - pouch GLBs, 1.8–2.0 MB each;
  - `label-herbal-black-salt-8192.webp`, 0.9 MB;
  - jar GLB, 0.6 MB;
  - `field-sharp.webp`, 0.63 MB.
- **First load** takes the jar GLB (501 KB) and the 4096 label (449 KB). No file over 1 MB loads before it's needed: the pouch GLBs load only near the products.
- **Frame rate and long tasks:** see #7.

### 5. Accessibility
- **axe:**
  - The homepage has 2 issues (#15, #16).
  - Recipe, product and index pages, and the menu, bag and reader states, have 0.
  - The 404 page has 3 (no main landmark, region, skip link).
- **Keyboard:** 70 tabs from the top; everything focused was on screen, and no keyboard trap was found.
  - The recipe card links report no outline of their own: the card draws the ring, so check it by eye.
  - Focus landed on `<body>` once.
- **Reduced motion:** the static layout is complete (`sheet-reduced-motion.jpg`), apart from #9.
- **125% / 150% text:** no horizontal overflow on / or a recipe page at 1440 and 390. The automatic clipping probe gave only false positives (screen-reader-only spans), so no clipping was detected but this needs a manual look.
- **Contrast:** axe found no colour-contrast violations.

### 6. SEO and sharing
- **Titles and descriptions:** present and unique on every page.
- **Other checks:** `lang="en-IN"`, one h1 per page, no heading skips except #16.
- **JSON-LD:** Organization on every page, Product on product pages, Recipe on recipe pages; all parse.
- **Files:** `sitemap.xml` works (200); `icon.png` and `apple-icon.png` exist.
- **Problems:** issues 3, 11 and 12.

### 7. Content and compliance
The full list with file:line is in `content-scan.txt`: 62 lines, covering every [CONFIRM], [PRICE] and [DATE] marker in the code.

Words found:
- "Himalayan" in a model filename and in the pink artwork (#2).
- Health claims in the jar label artwork (#1).
- "Self iodized" in the lake label text.
- "Best" only in code comments and "Best before".

Consistent everywhere:
- FSSAI 12224999000443.
- Prices ₹199 / ₹149.
- Product names.

Not consistent: the phone numbers (#13) and the lake salt's Hindi name (#14).
