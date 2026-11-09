"""Build Pyoor 1 kg PET jar models as GLB (glTF 2.0).
Requires: pip install numpy pillow pygltflib

Units: metres, Y up, label front panel faces +Z.
Parts (separate nodes so a developer can swap textures/materials):
  Body  - clear PET shell (KHR_materials_transmission + ior + volume)
  Salt  - salt fill visible through the jar
  Label - wrap-around label with the real artwork
  Lid   - dark ribbed screw lid
"""
import io, math, sys, os
import numpy as np
from PIL import Image
import pygltflib as g

SEG = 128  # around-the-jar segments

# ---------- dimensions (measured: 12.2 cm tall incl. cap, 10 cm diameter) ----------
R_BODY = 0.050        # outer radius of the jar wall (10 cm diameter)
H_BODY = 0.1065       # body top (hidden under the cap)
R_NECK = 0.0488       # threaded neck under the cap
NECK_Y = 0.1015
LABEL_Y0 = 0.020      # label bottom, 2.0 cm from the base (from photo)
LABEL_Y1 = 0.0933     # label top, 9.3 cm (from photo)
R_LABEL = R_BODY + 0.0003
LABEL_FRONT_U = 0.49  # horizontal position of the label's front panel (0..1 of artwork)
FILL_Y = 0.1000       # salt level ~1 cm above the label (from photo)
LID_Y0, LID_Y1 = 0.1045, 0.122
R_LID = 0.0503
LID_T = 0.0016        # cap wall thickness


def compute_normals(pos, idx, ring):
    n = np.zeros_like(pos)
    tri = pos[idx]
    fn = np.cross(tri[:, 1] - tri[:, 0], tri[:, 2] - tri[:, 0])
    for k in range(3):
        np.add.at(n, idx[:, k], fn)
    if ring:
        rows = len(pos) // ring
        for r in range(rows):
            a, b = r * ring, r * ring + ring - 1
            s = n[a] + n[b]
            n[a] = n[b] = s
    ln = np.linalg.norm(n, axis=1, keepdims=True)
    ln[ln == 0] = 1
    return (n / ln).astype(np.float32)


def grid_mesh(fn_pos, rows, u_scale=1.0, v_of_row=None, u_offset=0.0, theta_span=2 * math.pi, closed=True):
    cols = SEG + 1
    pos, uv = [], []
    for j, row in enumerate(rows):
        v = v_of_row(j, row) if v_of_row else j / (len(rows) - 1)
        for i in range(cols):
            u = i / SEG
            theta = (u - 0.5) * theta_span  # u=0.5 -> front (+Z)
            pos.append(fn_pos(theta, row))
            uv.append((u_offset + u * u_scale, v))
    pos = np.array(pos, np.float32)
    uv = np.array(uv, np.float32)
    idx = []
    for j in range(len(rows) - 1):
        for i in range(SEG):
            a = j * cols + i
            b = a + cols
            idx += [(a, b, a + 1), (a + 1, b, b + 1)]
    idx = np.array(idx, np.uint32)
    nrm = compute_normals(pos, idx, cols if closed else 0)
    return pos, nrm, uv, idx


def lathe(profile, **kw):
    def f(t, p):
        r, y = p[0], p[1]
        return (r * math.sin(t), y, r * math.cos(t))
    return grid_mesh(f, profile, **kw)


# ---------------------------- parts ----------------------------------------
def body():
    # outer profile, listed top -> bottom so faces point outward
    prof = [(R_NECK, H_BODY), (R_NECK, NECK_Y), (R_BODY - 0.0006, NECK_Y - 0.0012),
            (R_BODY, NECK_Y - 0.003), (R_BODY, 0.06), (R_BODY, 0.006),
            (R_BODY - 0.0012, 0.0018), (R_BODY - 0.004, 0.0004), (0.040, 0.0004), (0.0, 0.0012)]
    return lathe(prof)


TEX_PER_M = 66.7  # texture tiles per metre (one tile = 1.5 cm tall)


def salt():
    """Packed salt against the jar wall (what you see through the PET)."""
    r_in = R_BODY - 0.0018
    prof = [(0.0466, FILL_Y - 0.0008), (r_in, NECK_Y - 0.0045), (r_in, 0.05), (r_in, 0.006),
            (r_in - 0.002, 0.0028), (0.0, 0.0028)]
    def v_of(j, p):
        return p[1] * TEX_PER_M
    return lathe(prof, u_scale=10.0, v_of_row=v_of)


def salt_top():
    """Heaped, uneven top surface of the salt with planar UVs (no radial stretching)."""
    rings = 28
    r_edge = 0.0466
    rows = [r_edge * (1 - k / rings) for k in range(rings + 1)]  # edge -> centre
    def h(t, r):
        q = r / r_edge
        mound = 0.0016 * (1 - q * q)                      # gentle dome
        ripple = 0.00045 * (math.sin(3 * t + 1.3) * math.sin(9 * q + 0.7)
                            + 0.6 * math.sin(7 * t - 0.4) * math.cos(13 * q)
                            + 0.4 * math.sin(17 * t + 2.0) * math.sin(21 * q + 1.1))
        return FILL_Y - 0.0008 + mound + ripple * (0.35 + 0.65 * q)
    def f(t, r):
        return (r * math.sin(t), h(t, r), r * math.cos(t))
    pos, nrm, uv, idx = grid_mesh(f, rows)
    uv = np.stack([pos[:, 0] * TEX_PER_M, pos[:, 2] * TEX_PER_M], 1).astype(np.float32)
    # rows go edge -> centre; flip winding so the surface faces up
    idx = idx[:, [0, 2, 1]].copy()
    nrm = compute_normals(pos, idx, SEG + 1)
    return pos, nrm, uv, idx


def label():
    h = LABEL_Y1 - LABEL_Y0
    w = h * LABEL_W / LABEL_H            # real artwork width at the measured height
    span = min(w / R_LABEL, 2 * math.pi * 0.995)  # angle the label covers
    rows = [LABEL_Y1, LABEL_Y0]          # v=0 at top of image
    def f(t, y):
        return (R_LABEL * math.sin(t), y, R_LABEL * math.cos(t))
    # artwork front panel (LABEL_FRONT_U) centred on +Z
    return grid_mesh(f, rows, u_offset=LABEL_FRONT_U - 0.5, theta_span=span, closed=False)


def lid():
    """Closed shell (outer wall, rim, inner wall) so the smoky plastic has real thickness.
    Two shallow horizontal grooves like the real cap."""
    g1, g2 = LID_Y0 + 0.0055, LID_Y0 + 0.0062
    ro, ri = R_LID, R_LID - LID_T
    prof = [  # outer: top centre -> top edge -> down the side -> bottom rim; then inner back up
        (0.0, LID_Y1), (ro - 0.003, LID_Y1), (ro - 0.0008, LID_Y1 - 0.0004), (ro, LID_Y1 - 0.0016),
        (ro, g2 + 0.0004), (ro - 0.0004, g2), (ro - 0.0004, g1), (ro, g1 - 0.0004),
        (ro, LID_Y0 + 0.0006), (ro - 0.0005, LID_Y0), (ri, LID_Y0),
        (ri, LID_Y1 - LID_T - 0.001), (ri - 0.002, LID_Y1 - LID_T), (0.0, LID_Y1 - LID_T)]
    return lathe(prof)


def lid_rim():
    """Thin dark band at the cap's top edge (thick plastic seen edge-on)."""
    ro = R_LID + 0.00005
    prof = [(ro - 0.0030, LID_Y1 + 0.00005), (ro - 0.0008, LID_Y1 - 0.00035),
            (ro, LID_Y1 - 0.0016), (ro, LID_Y1 - 0.0024)]
    return lathe(prof)


# ---------------------------- glTF writer ----------------------------------
class Writer:
    def __init__(self):
        self.gltf = g.GLTF2(asset=g.Asset(generator="Pyoor jar builder", version="2.0"))
        self.gltf.scene = 0
        self.gltf.scenes = [g.Scene(nodes=[])]
        self.blob = bytearray()

    def _view(self, data, target=None):
        while len(self.blob) % 4:
            self.blob += b"\0"
        off = len(self.blob)
        self.blob += data
        self.gltf.bufferViews.append(g.BufferView(buffer=0, byteOffset=off, byteLength=len(data), target=target))
        return len(self.gltf.bufferViews) - 1

    def _acc(self, arr, typ, target):
        v = self._view(arr.tobytes(), target)
        ct = g.UNSIGNED_INT if arr.dtype == np.uint32 else g.FLOAT
        kw = {}
        if typ == "VEC3" and ct == g.FLOAT:
            kw = dict(min=arr.min(0).tolist(), max=arr.max(0).tolist())
        self.gltf.accessors.append(g.Accessor(bufferView=v, componentType=ct, count=len(arr), type=typ, **kw))
        return len(self.gltf.accessors) - 1

    def texture(self, path, quality=88, max_w=None, png=False):
        im = Image.open(path).convert("RGB")
        if max_w and im.width > max_w:
            im = im.resize((max_w, round(im.height * max_w / im.width)), Image.LANCZOS)
        buf = io.BytesIO()
        if png:
            im.save(buf, "PNG", optimize=True)
        else:
            im.save(buf, "JPEG", quality=quality)
        v = self._view(buf.getvalue())
        self.gltf.images.append(g.Image(bufferView=v, mimeType="image/png" if png else "image/jpeg"))
        if not self.gltf.samplers:
            self.gltf.samplers.append(g.Sampler(magFilter=9729, minFilter=9987, wrapS=10497, wrapT=10497))
        self.gltf.textures.append(g.Texture(sampler=0, source=len(self.gltf.images) - 1))
        return len(self.gltf.textures) - 1

    def material(self, name, **m):
        pbr = g.PbrMetallicRoughness(
            baseColorFactor=m.get("color", [1, 1, 1, 1]),
            metallicFactor=m.get("metallic", 0.0),
            roughnessFactor=m.get("roughness", 0.5),
            baseColorTexture=g.TextureInfo(index=m["tex"]) if "tex" in m else None,
            metallicRoughnessTexture=g.TextureInfo(index=m["mr"]) if "mr" in m else None)
        ext = {}
        if "transmission" in m:
            ext["KHR_materials_transmission"] = {"transmissionFactor": m["transmission"]}
            ext["KHR_materials_ior"] = {"ior": 1.57}
            ext["KHR_materials_volume"] = {"thicknessFactor": m.get("thickness", 0.0012),
                                          "attenuationDistance": m.get("att_dist", 0.4),
                                          "attenuationColor": m.get("att_color", [0.95, 0.96, 0.97])}
            for e in ext:
                if e not in self.gltf.extensionsUsed:
                    self.gltf.extensionsUsed.append(e)
        mat = g.Material(name=name, pbrMetallicRoughness=pbr, doubleSided=m.get("double", False),
                         normalTexture=g.NormalMaterialTexture(index=m["normal"], scale=m.get("nscale", 1.0)) if "normal" in m else None,
                         alphaMode=m.get("alpha", "OPAQUE"), extensions=ext or {})
        self.gltf.materials.append(mat)
        return len(self.gltf.materials) - 1

    def mesh(self, name, geo, mat):
        pos, nrm, uv, idx = geo
        attrs = g.Attributes(POSITION=self._acc(pos, "VEC3", g.ARRAY_BUFFER),
                             NORMAL=self._acc(nrm, "VEC3", g.ARRAY_BUFFER),
                             TEXCOORD_0=self._acc(uv, "VEC2", g.ARRAY_BUFFER))
        ia = self._acc(idx.reshape(-1).astype(np.uint32), "SCALAR", g.ELEMENT_ARRAY_BUFFER)
        self.gltf.meshes.append(g.Mesh(name=name, primitives=[g.Primitive(attributes=attrs, indices=ia, material=mat)]))
        self.gltf.nodes.append(g.Node(name=name, mesh=len(self.gltf.meshes) - 1))
        self.gltf.scenes[0].nodes.append(len(self.gltf.nodes) - 1)

    def save(self, path):
        while len(self.blob) % 4:
            self.blob += b"\0"
        self.gltf.buffers = [g.Buffer(byteLength=len(self.blob))]
        self.gltf.set_binary_blob(bytes(self.blob))
        self.gltf.save_binary(path)


def build(label_path, salt_name, out_path):
    global LABEL_W, LABEL_H
    LABEL_W, LABEL_H = Image.open(label_path).size
    T = TEX
    w = Writer()
    t_label = w.texture(label_path, quality=90, max_w=2400)
    t_alb = w.texture(T + salt_name + "_albedo.jpg", quality=88)
    t_nrm = w.texture(T + salt_name + "_normal.png", png=True)
    t_mr = w.texture(T + salt_name + "_mr.jpg", quality=85)
    m_body = w.material("PET_clear", color=[0.97, 0.98, 1.0, 1.0], roughness=0.06, transmission=1.0, double=True)
    m_salt = w.material("Salt_crystals", tex=t_alb, normal=t_nrm, nscale=1.0, mr=t_mr, roughness=1.0)
    m_label = w.material("Label", tex=t_label, roughness=0.38, double=True)
    # smoky transparent cap: tinted by thickness, like the real jar
    m_lid = w.material("Lid_smoky_PET", color=[0.78, 0.78, 0.80, 1.0], roughness=0.05, transmission=1.0,
                       thickness=0.0016, att_dist=0.006, att_color=[0.40, 0.40, 0.42], double=True)
    m_rim = w.material("Lid_rim", color=[0.07, 0.07, 0.08, 1.0], roughness=0.12)
    w.mesh("Salt", salt(), m_salt)
    w.mesh("Salt_top", salt_top(), m_salt)
    w.mesh("Label", label(), m_label)
    w.mesh("Lid", lid(), m_lid)
    w.mesh("Lid_rim", lid_rim(), m_rim)
    w.mesh("Body", body(), m_body)
    w.save(out_path)


HERE = os.path.dirname(os.path.abspath(__file__))
TEX = os.path.join(HERE, "textures") + os.sep

if __name__ == "__main__":
    # usage: python3 tools/3d/build_jar.py [output_dir]   (default: tools/3d/source)
    O = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, "source")
    build(TEX + "label-herbal-black-salt.png", "black", O + "/pyoor-herbal-black-salt.glb")
    build(TEX + "label-natural-lake-salt.png", "white", O + "/pyoor-natural-lake-salt.glb")
    build(TEX + "label-himalayan-pink-salt.png", "pink", O + "/pyoor-himalayan-pink-salt.glb")
    print("ok")
