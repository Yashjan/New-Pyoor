# Crystal Dawn: frame-rate report

Measured on the production build (`next build && next start`). Chrome 131 headless was driven
by Playwright, using the machine's real GPU (`--use-angle=gl`, Intel Xe Graphics). Each run was
a fresh session, so it is a first visit.

**What was measured:** every `requestAnimationFrame` interval from the first frame of the story
to the reveal (`data-intro-done`). That covers the whole intro, not just a sample of it.

**4× CPU throttling:** applied with DevTools' `Emulation.setCPUThrottlingRate`.

**Recording:** off in the FPS runs, so that video capture doesn't affect the numbers.

## Under 4× CPU throttling

| Run             | Viewport      | Frames | Avg fps  | p95 frame | p99 frame | Longest | Frames > 33 ms |
| --------------- | ------------- | ------ | -------- | --------- | --------- | ------- | -------------- |
| Phone, 4× CPU   | 390 × 844 @2x | 227    | **58.2** | 16.8 ms   | 16.8 ms   | 133 ms  | 1              |
| Desktop, 4× CPU | 1440 × 900    | —      | **60.0** | 16.8 ms   | 16.8 ms   | 16.8 ms | 0              |

The phone run has one long frame of 133 ms; this run didn't record when it fell. Every other
frame in that run is 16.8 ms or less (p99 16.8 ms). In an earlier phone run on the same build
(before the final tweaks) no frame went over 16.8 ms.

## Unthrottled, and on Slow 4G (the recordings)

| Run                                     | Avg fps                              | p95     | p99     | Longest | Reveal after story start |
| --------------------------------------- | ------------------------------------ | ------- | ------- | ------- | ------------------------ |
| Desktop, first visit                    | 59.7                                 | 16.7 ms | 16.8 ms | 33 ms   | 3.79 s                   |
| Phone, first visit                      | 60.0                                 | 16.7 ms | 16.8 ms | 16.8 ms | 3.88 s                   |
| Phone, Slow 4G (1.6 Mbps, 562 ms RTT) ² | 59.2                                 | 16.8 ms | 16.8 ms | 50 ms   | 2.37 s ¹                 |
| Skip (click at 1.8 s)                   | 60.0                                 | 16.7 ms | 16.8 ms | 16.8 ms | 3.24 s                   |
| Desktop, reduced motion                 | static frame, 0.6 s hold, 0.3 s fade |         |         |         | 1.21 s                   |

² Measured without video recording. The recorded Slow 4G run gave 58.7 fps, p99 33 ms, 3
frames over 33 ms.

¹ On Slow 4G the page's JavaScript arrives about 4.4 s after navigation. First paint is at 1.4 s.

- **From first paint:** the horizon and seed play in CSS, which is already in the server HTML.
- **When the script runs:** the 4.5 s cap has passed, so the story goes straight to the glint,
  the release and the reveal.
- **The jar:** the 3D jar is still loading, so the poster stands in, and WebGL takes over after
  the reveal.

## What keeps it smooth

- **No allocation per frame.**
  - Glows are pre-rendered sprites.
  - Colours are fixed strings, and fading is done with `globalAlpha`.
  - Points live in typed arrays. The grains are 820 on desktop and 360 on phones.
  - The salt-pan cracks are cached on their own canvas and redrawn only as the sun rises.
- **The hero's 3D build waits until after the reveal.**
  - During the intro, only the jar GLB downloads (into the HTTP cache) and three.js is imported.
    Together these drive the intro's real progress.
  - The heavy steps run at the next idle moment after the reveal: WebGL context creation, the
    environment map, GLB parsing and shader compilation. Under 4× CPU throttling they cost
    about 1.6 s of main-thread time.
  - Until then the poster stands in, placed where the 3D jar renders.
- **The loader runs on its own clock,** advancing at most 1/30 s per frame. A stall pauses the
  drawing instead of making it jump.
- **The first paint is pure CSS:** the horizon line and the seed. three.js is parsed while that
  plays, and the canvas takes over at the same moment in the animation.

## Other checks

- **Loader JavaScript:** 7.8 KB gzipped. That covers `components/loader/*` and
  `lib/loader/*`, minified, without React, Next or the lazily imported GSAP.
- **Layout shift (CLS):** 0 on desktop and on phones, across the whole intro and the reveal.
- **Visits and pages:**
  - A second visit in the same session gets the fade (`data-intro=fade`).
  - `?intro=always` replays the full story.
  - The product page has no intro.
- **Console errors:** none in any run.
