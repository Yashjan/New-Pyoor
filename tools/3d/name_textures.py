"""Give every image in a .glb a stable name based on how its material uses it.

build_jar.py writes unnamed images, and `gltf-transform resize` can only target
textures by name. This step runs before compression so tools/3d/compress.sh can
size the label and the salt maps differently.

Names: "<material>_<slot>", lower-cased, e.g. "label_basecolor", "salt_crystals_normal".

Standard library only. Usage: python3 tools/3d/name_textures.py <in.glb> <out.glb>
"""
import json
import struct
import sys

SLOTS = {
    "baseColorTexture": "basecolor",
    "metallicRoughnessTexture": "mr",
    "normalTexture": "normal",
    "occlusionTexture": "occlusion",
    "emissiveTexture": "emissive",
}


def read_glb(path):
    data = open(path, "rb").read()
    magic, version, _ = struct.unpack_from("<4sII", data, 0)
    if magic != b"glTF" or version != 2:
        sys.exit(f"{path}: not a glTF 2.0 binary")
    json_len, json_type = struct.unpack_from("<I4s", data, 12)
    assert json_type == b"JSON"
    doc = json.loads(data[20 : 20 + json_len])
    rest = data[20 + json_len :]  # BIN chunk (header included), untouched
    return doc, rest


def write_glb(path, doc, rest):
    body = json.dumps(doc, separators=(",", ":")).encode()
    body += b" " * (-len(body) % 4)
    total = 12 + 8 + len(body) + len(rest)
    with open(path, "wb") as f:
        f.write(struct.pack("<4sII", b"glTF", 2, total))
        f.write(struct.pack("<I4s", len(body), b"JSON"))
        f.write(body)
        f.write(rest)


def texture_refs(material):
    pbr = material.get("pbrMetallicRoughness", {})
    for key, slot in SLOTS.items():
        ref = pbr.get(key) or material.get(key)
        if ref is not None:
            yield ref["index"], slot


def main(src, dst):
    doc, rest = read_glb(src)
    textures, images = doc.get("textures", []), doc.get("images", [])
    for material in doc.get("materials", []):
        base = material.get("name", "material").lower()
        for tex_index, slot in texture_refs(material):
            source = textures[tex_index].get("source")
            if source is not None and not images[source].get("name"):
                images[source]["name"] = f"{base}_{slot}"
    write_glb(dst, doc, rest)
    print(f"{dst}: " + ", ".join(i.get("name", "?") for i in images))


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2])
