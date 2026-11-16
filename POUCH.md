# Pyoor 3D pouches (v1)

| File | What |
|---|---|
| `public/models/pyoor-pouch-herbal-black-salt.glb` | Herbal Black Salt 1 kg stand-up zip pouch (~1.9 MB, meshopt + WebP) |
| `public/models/pyoor-pouch-natural-lake-salt.glb` | Natural Lake Salt 1 kg pouch (~1.9 MB) |
| `tools/3d/pouch/` | Build scripts, prepared artwork (front, back with the temporary barcode removed, window mask) and preview renders |

Size: 23.0 × 30.5 cm, gusset 9.2 cm. Units metres, Y up, front faces +Z, base on y = 0.
Nodes: `Pouch_front` (artwork + clear window via KHR_materials_transmission + transmissionTexture),
`Pouch_back`, `Pouch_base`, `Salt` (the fill seen through the window).
Materials: glossy metallised film (clearcoat), gold foil more metallic, fine creases + zip ridges in the normal map.
Loading: GLTFLoader + MeshoptDecoder (same as the jars).
The barcode is removed from the back (temporary, not GS1). Re-run `prep.py`, `fill2.py`, `build_pouch.py` when the artwork changes.
