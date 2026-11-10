# Crystal Dawn: preview and measurement scripts

The approved Crystal Dawn loader (v3), saved so we can return to it. It is tagged as
`crystal-dawn-v3`, on the branch `feat/first-visit-loader`.

## What is in this folder

These are the Playwright scripts that produced the deliverables in `docs/video/loader/`:

| Script | What it does |
|---|---|
| `record.mjs` | Records a first visit and reports frame timing. Options: video, 4× CPU, Slow 4G, reduced motion, skip. |
| `checks.mjs` | Checks layout shift, the behaviour of a second visit and `?intro=always`, and the poster → WebGL hand-off. |
| `align.mjs` | Confirms the CSS phase A and the canvas line up pixel for pixel. |
| `phaseC.mjs` | Captures phase C, for checking the glow for banding. |
| `lid.mjs`, `jarbox.mjs` | Measure where the jar and its lid sit on screen. |
| `gpu.mjs` | Checks which GPU headless Chrome is using. |

To run them, install `playwright-core` and point it at a running build. Pass
`--use-angle=gl` so Chrome uses the real GPU.

## Where the drawing code went

The original stills scripts (`scene.js` … `scene3.js`, `stills*.mjs`) were lost when the
scratchpad they lived in was cleared. Their drawing code was ported, with the v3 refinements,
to `components/loader/dawn.ts`; the timeline is in `components/loader/CrystalDawn.tsx`. The
stills themselves are in `docs/images/loader/stills*`.
