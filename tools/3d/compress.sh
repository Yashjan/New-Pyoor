#!/usr/bin/env bash
# Compress the source jar models into web-ready files in public/models/.
#
#   npm run models            compress every tools/3d/source/*.glb
#   npm run models:inspect    print the extension/texture report for public/models/*.glb
#
# Pipeline (per jar):
#   1. name_textures.py   name images by material slot so they can be targeted below
#   2. dedup + prune      drop duplicate/unused data
#   3. resize             salt normal + roughness maps to 512 px (they tile every ~1.5 cm);
#                         the label and salt albedo keep full resolution
#   4. webp               normal map at q90 (lossy normals glint badly), everything else q80
#   5. meshopt            geometry compression + quantization (EXT_meshopt_compression)
#
# Deliberately NOT used: `optimize` (its join/flatten/palette steps merge the Body, Salt,
# Salt_top, Label, Lid and Lid_rim nodes the hero animation needs) and KTX2 (the Basis
# transcoder would add ~200 KB to the hero budget).
#
# Material extensions (KHR_materials_transmission / ior / volume) pass through untouched;
# the script fails if any of them goes missing.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SRC="$ROOT/tools/3d/source"
OUT="$ROOT/public/models"
GT="$ROOT/node_modules/.bin/gltf-transform"
BUDGET_BYTES=$((600 * 1024))
REQUIRED_EXT=(KHR_materials_transmission KHR_materials_ior KHR_materials_volume)

[[ -x "$GT" ]] || { echo "gltf-transform not found; run npm install first" >&2; exit 1; }

inspect() {
  for f in "$OUT"/*.glb; do
    echo "== $(basename "$f") ($(stat -c %s "$f") bytes)"
    "$GT" inspect "$f" --format md 2>/dev/null | grep -E 'extensionsUsed|^\| [0-9]+ ' || true
  done
}

if [[ "${1:-}" == "--inspect" ]]; then inspect; exit 0; fi

mkdir -p "$OUT"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

for src in "$SRC"/*.glb; do
  name="$(basename "$src")"
  echo "→ $name"
  python3 "$ROOT/tools/3d/name_textures.py" "$src" "$TMP/0.glb" >/dev/null
  "$GT" dedup "$TMP/0.glb" "$TMP/1.glb" >/dev/null
  "$GT" prune "$TMP/1.glb" "$TMP/2.glb" >/dev/null
  "$GT" resize "$TMP/2.glb" "$TMP/3.glb" --pattern "*_{normal,mr}" --width 512 --height 512 >/dev/null
  "$GT" webp "$TMP/3.glb" "$TMP/4.glb" --slots normalTexture --quality 90 --effort 80 >/dev/null
  "$GT" webp "$TMP/4.glb" "$TMP/5.glb" --quality 80 --effort 80 >/dev/null
  "$GT" meshopt "$TMP/5.glb" "$OUT/$name" >/dev/null

  size=$(stat -c %s "$OUT/$name")
  report="$("$GT" inspect "$OUT/$name" --format md 2>/dev/null)"
  for ext in "${REQUIRED_EXT[@]}"; do
    grep -q "$ext" <<<"$report" || { echo "  ✗ $ext was lost" >&2; exit 1; }
  done
  status="ok"; (( size > BUDGET_BYTES )) && status="OVER 600 KB BUDGET"
  printf '  %s → %d KB (%s)\n' "$(( $(stat -c %s "$src") / 1024 )) KB" $((size / 1024)) "$status"
done
