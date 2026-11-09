# Pyoor asset pack

Copy these folders into the repo root as they are.

- `tools/3d/source/`: original, uncompressed jar models (glTF 2.0 .glb). Compress them into `public/models/`.
  Units are metres, Y up, the label front faces +Z. The jar is 12.2 cm tall including the cap and 10 cm across.
  Nodes: Body (clear PET, transmission/ior/volume), Salt, Salt_top, Label, Lid (smoky transparent PET), Lid_rim.
- `tools/3d/build_jar.py`: rebuilds all three models from the textures. Run `python3 tools/3d/build_jar.py`.
  Needs: `pip install numpy pillow pygltflib`.
- `tools/3d/crystal_tex.py`: regenerates the salt crystal textures (albedo, normal, metallic-roughness).
- `tools/3d/textures/`: label artwork (from the print PDF) and salt crystal textures.
  To change a label, replace the PNG and rerun build_jar.py.
- `public/brand/`: logo in flat gold and ivory (for navy backgrounds), plus the original SVG.
- `public/images/`: real product photos. Use `jar-black-salt-photo.jpg` as the temporary hero poster.

Note: the labels still carry the old health claims and "100% Natural". They'll be replaced
when the labels are reprinted. The website copy must not repeat them.
