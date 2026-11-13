import {
  CanvasTexture,
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  SRGBColorSpace,
  ShadowMaterial,
} from 'three';

/** A round falloff (white → transparent), tinted by the material colour. */
function blobTexture(stops: readonly (readonly [number, number])[]): CanvasTexture {
  const S = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = S;
  const g = canvas.getContext('2d')!;
  const grad = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  for (const [o, a] of stops) grad.addColorStop(o, `rgba(255,255,255,${a})`);
  g.fillStyle = grad;
  g.fillRect(0, 0, S, S);
  const t = new CanvasTexture(canvas);
  t.colorSpace = SRGBColorSpace;
  return t;
}

// roughly Gaussian: no visible edge anywhere
const AMBIENT_STOPS = [
  [0, 1],
  [0.25, 0.82],
  [0.5, 0.45],
  [0.75, 0.14],
  [1, 0],
] as const;
// tighter core: nearly solid under the base, then a short falloff
const CORE_STOPS = [
  [0, 1],
  [0.55, 0.92],
  [0.8, 0.38],
  [1, 0],
] as const;

/**
 * A soft contact shadow, two layers: a tight warm-grey core and a wide ambient ellipse (sized
 * for the 10 cm jar; scale the group for other things), ~0.35 at its darkest, blurred like a
 * studio floor shadow. `set(o)` fades it, 0–1.
 */
export function createContact() {
  const group = new Group();
  const mats: [MeshBasicMaterial, number][] = [];
  const layer = (
    stops: readonly (readonly [number, number])[],
    opacity: number,
    w: number,
    d: number,
    y: number,
  ) => {
    const mat = new MeshBasicMaterial({
      map: blobTexture(stops),
      color: 0x5e5246, // warm grey, not navy
      transparent: true,
      opacity,
      depthWrite: false,
      fog: false,
    });
    const m = new Mesh(new PlaneGeometry(1, 1), mat);
    m.rotation.x = -Math.PI / 2;
    m.position.y = y;
    m.scale.set(w, d, 1);
    m.renderOrder = 1;
    group.add(m);
    mats.push([mat, opacity]);
  };
  layer(AMBIENT_STOPS, 0.13, 0.22, 0.13, 0.0004); // soft ambient, 22 × 13 cm
  layer(CORE_STOPS, 0.25, 0.115, 0.022, 0.0006); // contact core: 1.15 × base, depth 0.19 × width
  return {
    group,
    mats,
    set(o: number) {
      for (const [mat, base] of mats) mat.opacity = base * o;
    },
  };
}

/**
 * The jar's contact shadow and the grains' shadows on the floor.
 */
export function createGround() {
  const jarContact = createContact();
  const contact = jarContact.group;
  const contactMats = jarContact.mats;

  // Realtime shadows are only cast by the pour grains (the heap); tinted navy, not grey.
  const shadowFloor = new Mesh(
    new PlaneGeometry(4, 4),
    new ShadowMaterial({ color: 0x121a3b, opacity: 0.12 }),
  );
  shadowFloor.rotation.x = -Math.PI / 2;
  shadowFloor.receiveShadow = true;

  return {
    contact,
    contactMats,
    shadowFloor,
    shadowMat: shadowFloor.material,
  };
}
