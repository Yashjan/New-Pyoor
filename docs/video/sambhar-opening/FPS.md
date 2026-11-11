# "Sambhar is engraved": recordings and frame-rate report

## How it was measured

- **Build:** the production build (`next build && next start`), driven by Playwright in
  Chrome 131 headless on the machine's real GPU (`--use-angle=gl`, Intel Xe Graphics).
- **Visits:** every run is a fresh session, so a first visit, except the return visit.
- **Frames:** every `requestAnimationFrame` interval is recorded, split three ways:
  - **intro:** from the moment the script takes over the engraving to `data-intro-done`, after
    the scroll cue;
  - **opening:** the first 120vh of scroll;
  - **sequence:** the jar sequence's 520vh, then all the way back up, which shows it reverses.
- **Scrolling:** scripted mouse-wheel steps through Lenis.
- **Throttling:** 4× CPU via DevTools' `Emulation.setCPUThrottlingRate`. Slow 4G is DevTools'
  profile: 1.6 Mbps, 562.5 ms RTT, with the cache disabled.
- **Layout shift (CLS):** 0 in every run.
- **Console errors:** none in any run.

## Recordings (this folder)

| File                               | What it shows                                                         |
| ---------------------------------- | --------------------------------------------------------------------- |
| `engraving-4s-desktop.mp4`         | The engraving alone, 4 s from first paint, 1440 × 900                 |
| `engraving-4s-mobile.mp4`          | The same, 390 × 844                                                   |
| `first-visit-desktop.mp4`          | Engraving → ink → header → scroll through everything and back         |
| `first-visit-mobile.mp4`           | The same, 390 × 844                                                   |
| `return-visit-desktop.mp4`         | A reload in the same tab: SAMBHAR already filled                      |
| `reduced-motion-desktop.mp4`       | `prefers-reduced-motion`: the filled word and static page, fades only |
| `throttled-mobile-slow4g-cpu4.mp4` | Slow 4G with 4× CPU throttling, 390 × 844, full run                   |

## Frame rate

| Run                         | Intro: avg / p95 / >33 ms | Opening scroll: avg / p95 / >33 ms | Jar sequence: avg / p95 / >33 ms |
| --------------------------- | ------------------------- | ---------------------------------- | -------------------------------- |
| Desktop, first visit        | 59.3 / 16.8 ms / 1        | 60.0 / 16.7 ms / 0                 | 60.0 / 16.7 ms / 0               |
| Phone, first visit          | 59.5 / 16.8 ms / 1        | 60.0 / 16.7 ms / 0                 | 60.0 / 16.7 ms / 0               |
| Desktop, return visit       | none (starts filled)      | 60.0 / 16.7 ms / 0                 | 59.9 / 16.8 ms / 2               |
| **Desktop, 4× CPU**         | 53.0 / 16.7 ms / 6        | 52.8 / 33.4 ms / 3                 | 52.7 / 33.4 ms / 64              |
| **Phone, 4× CPU**           | 54.3 / 16.8 ms / 5        | 60.0 / 16.8 ms / 0                 | 58.6 / 16.8 ms / 9               |
| **Phone, Slow 4G + 4× CPU** | 54.4 / 16.8 ms / 4        | 57.4 / 16.8 ms / 3                 | 57.3 / 16.8 ms / 20              |

### Where the long frames are

All three throttled runs show the same pattern:

- **During the intro:**
  - **0.1–1.2 s after first paint:** frames of 50–200 ms while React hydrates and the
    three.js and GSAP modules are evaluated.
  - **Why they stay:** those module loads count towards the engraving's progress (fonts 20%,
    three.js and GSAP 30%, the jar 50%), so they can't be deferred without making the
    progress fake.
  - **What happens on screen:** the engraving's clock keeps running, and after a stall the pen
    catches up, at no more than 1/1.2 of the word per second.
- **After the intro is done:** one to three frames of 250–400 ms. This is the 3D scene being
  built: the WebGL context, the environment map, parsing the GLB, compiling shaders.
  - It is held back until the scroll cue is up, so the engraving, the ink and the glint never
    stall.
  - It lands while the visitor is reading SAMBHAR. A visitor who scrolls in that half second
    sees the poster jar.

### What keeps the opening smooth

- **Every per-frame change is a transform or an opacity:**
  - **Top half:** two static clips; the script only moves the inner layer.
    - The outer layer is cut at the header's bottom edge.
    - The inner layer is cut at the seam, which moves with it.
  - **Bottom half:** one static clip at the seam.
  - **Jar mask:** a static mask, three screens tall, that moves down with the bottom half, while
    the jar is moved back up inside it.
- **Before this:** an earlier version animated `clip-path` and `mask-image` and set custom
  properties on the stage. Under 4× CPU it ran the opening at 39.9 fps. That version isn't
  committed.
- **The engraving:** each hairline has `pathLength="1"` and a stroke width in font units, so the
  dash is exact at any size.
  - The pen tip is one SVG circle per contour, moved with `getPointAtLength`.
  - The hairlines and the ink are two copies of the word, one per half, with no per-frame
    allocation.

## Timings (unthrottled, desktop first visit)

| Event                                                     | After navigation |
| --------------------------------------------------------- | ---------------- |
| First paint: the CSS engraving starts on its 3 s clock    | 0.13 s           |
| The script takes over the engraving's clock (no jump)     | 0.30 s           |
| Engraved: real progress, with the spring's 1.2 s minimum  | ≈ 1.5 s          |
| Scroll unlocked: after the ink, the outline and the glint | 3.13 s           |
| Header, small line and scroll cue in; intro done          | 4.43 s           |

- **On Slow 4G:**
  - First paint is at 1.56 s, and the CSS engraving starts drawing straight away.
  - The script arrives at 3.87 s and picks up the engraving where it is.
  - The intro is done at 7.51 s.
- **Without JavaScript:** a CSS failsafe brings in the ink at 3.1 s, the header at 3.6 s, and
  the small line and the cue after that.
