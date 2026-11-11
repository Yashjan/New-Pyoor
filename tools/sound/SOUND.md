# Pyoor sound kit (v1)

All sounds are synthesised in code (`tools/sound/synth.py`, numpy + scipy). No samples, no licences.
Rebuild: `python3 tools/sound/synth.py`, then encode each WAV to 128 kbps MP3.

| File | Length | Use |
|---|---|---|
| `public/sounds/wind-loop.mp3` | 24 s, seamless loop | Bed from the SAMBHAR handoff through the whole Journey |
| `public/sounds/water-loop.mp3` | 16 s, seamless loop | Scene 01 Brine (water through the sluice) |
| `public/sounds/rake.mp3` | ~2 s one-shot | Scene 03 Harvest, when the rake moves forward |
| `public/sounds/jar-tone.mp3` | ~5 s one-shot | Step 2: the moment the 3D jar fills in |
| `public/sounds/cap-clicks.mp3` | ~2.4 s one-shot | Jar sequence: the cap starts unscrewing |

Total ~800 KB. It loads only after the visitor turns sound on.
Any file can later be swapped for a real recording from Sambhar with the same name.
