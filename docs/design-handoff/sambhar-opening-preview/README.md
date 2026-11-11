# "Sambhar is engraved": still-frame preview

These files render the stills in `docs/images/sambhar-opening/stills-v1/`.

| File | What it is |
|---|---|
| `opening.js` | Draws one frame of the opening from a state object (`SO.render(state)`), injected into the real homepage. |
| `glyphs.json` | Cormorant Garamond 500 outlines for S, A, M, B, H and R. |
| `so-stills.mjs` | The Playwright runner. It renders the 5 frames at 1440×900 and 390×844 (2×), plus the 2× crops. |
| `glyphscan.mjs`, `ascan.mjs` | Measure the H and A crossbars, and the font's own kerning. |

## Where the outlines come from

`glyphs.json` was extracted with fontTools from the site's own font file, the basic Latin
subset of Cormorant Garamond 500 that next/font serves. It holds, per letter:

- the original outline, used for the ink fill;
- the contours reordered for the engraving: outer shapes first, each starting at its top-left
  point and running down its left side first;
- the advance width and bounds.

## Running it

`node so-stills.mjs <base-url> <out-dir> <dir with opening.js + glyphs.json>`, with the
homepage served at `<base-url>`.

## v2 stills, and the production build

The v2 stills in `docs/images/sambhar-opening/stills-v2/` used:

- `glyphs-clean.json`: the outlines after a boolean union, with one clean outer contour per
  letter, plus counters;
- `so-stills-v2.mjs`: the runner for those stills.

The shipped opening doesn't use either file:

- **The component:** `components/opening/`.
- **The outlines:** generated at build time by `tools/glyphs/build.mjs` (`npm run glyphs`).
  That script uses opentype.js and paper.js, both devDependencies.
- **The generated paths:** committed as `components/opening/sambharGlyphs.ts`.
