# Pyoor design handoff

## design-system/
The approved system: "Label True" palette + "Classic serif" type.
- tokens.json: every colour, type style, spacing, radius, layout and timing value. Port it to styles/tokens.css (CSS custom properties). Don't invent new values.
- README.md: the brand book (rules for colour, type, the gold thread, logo, imagery, motion, content and claims). Follow it.
- components.css + component-*.md: reference implementations of Button, Horizon, ProductFeature, SiteHeader and Placeholder.

## hero-reference/
concept.html is a working single-file prototype of the homepage, tested in headless Chrome.
Port its LOGIC into the Next.js components; don't copy the file as-is.
- The 3D hero: the jar floats, the cap unscrews and flies out, the jar tilts ~113° around its base edge, ~6,000 precomputed crystals pour into a heap, the heap fades into a procedural salt-crust plane, and a gold horizon line appears with "Sambhar Lake".
  Everything is a pure function of scroll progress, so scrolling back up reverses it exactly.
  Look for: setJar(), the K camera keyframes, buildGrains()/updateGrains(), crustTexture(), and the beats timeline.
- Sections: Our roots, horizontal Journey (5 chapters, pinned), products as objects (ProductFeature), navy crystal close-up, recipes, navy footer with the logo on an ivory crest. Mobile menu overlay.
- In the prototype the model is base64-embedded (jar-model.js). In the repo, load /models/pyoor-herbal-black-salt.glb (compressed) with GLTFLoader + MeshoptDecoder, and apply motion RELATIVE to each node's base transform (meshopt quantization).
- hero-stages-*.jpg: what each scroll stage should look like (headless software rendering; real GPUs are smoother).
Known to-dos from the last test: frame the tilted jar slightly lower (camera look-at y +0.01 to +0.02 at p .42 and .74), fade the spread grains a little sooner (.78 to .88), and on phones keep the lid visible as it lifts.
