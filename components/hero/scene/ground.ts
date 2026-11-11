import {
  CanvasTexture,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  RepeatWrapping,
  SRGBColorSpace,
  ShadowMaterial,
} from 'three';
import { createRng } from './math';

/**
 * Procedural salt crust: a tileable Voronoi pattern of pale plates with darker cracks, the dry
 * pans of Sambhar Lake. Seeded, so it is identical on every load.
 */
export function crustTexture(): CanvasTexture {
  const S = 512;
  const N = 9;
  const C = S / N;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = S;
  const g = canvas.getContext('2d')!;
  const img = g.createImageData(S, S);
  const d = img.data;
  const { rnd } = createRng(7);

  const pts: [number, number][] = [];
  for (let j = 0; j < N; j++)
    for (let i = 0; i < N; i++)
      pts.push([(i + 0.15 + rnd() * 0.7) * C, (j + 0.15 + rnd() * 0.7) * C]);

  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const ci = Math.floor(x / C);
      const cj = Math.floor(y / C);
      let a = 1e9;
      let b = 1e9;
      for (let dj = -1; dj <= 1; dj++) {
        for (let di = -1; di <= 1; di++) {
          const ii = (ci + di + N) % N;
          const jj = (cj + dj + N) % N;
          const [px, py] = pts[jj * N + ii]!;
          const dx = x - (px + (ci + di - ii) * C);
          const dy = y - (py + (cj + dj - jj) * C);
          const q = dx * dx + dy * dy;
          if (q < a) {
            b = a;
            a = q;
          } else if (q < b) b = q;
        }
      }
      const edge = Math.sqrt(b) - Math.sqrt(a);
      const crack = Math.max(0, 1 - edge / 2.6);
      const v = 246 - crack * 40 + (rnd() - 0.5) * 9 - Math.sqrt(a) * 0.05;
      const i = (y * S + x) * 4;
      d[i] = v;
      d[i + 1] = v - 2 - crack * 4;
      d[i + 2] = v - 7 - crack * 8;
      d[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);

  const t = new CanvasTexture(canvas);
  t.wrapS = t.wrapT = RepeatWrapping;
  t.repeat.set(16, 16);
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

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
 * A soft contact shadow, two layers: a tight navy core and a wide ambient ellipse (sized for the
 * 10 cm jar; scale the group for other things). `set(o)` fades it, 0–1.
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
      color: 0x121a3b,
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
  layer(AMBIENT_STOPS, 0.08, 0.2, 0.12, 0.0004); // soft ambient, 20 × 12 cm
  layer(CORE_STOPS, 0.16, 0.11, 0.0198, 0.0006); // contact core: 1.1 × base, depth 0.18 × width
  return {
    group,
    mats,
    set(o: number) {
      for (const [mat, base] of mats) mat.opacity = base * o;
    },
  };
}

/**
 * The jar's contact shadow, the grains' shadows on the floor, the salt flats (behind the
 * ?saltPans flag) and the gold horizon line.
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

  const crustMat = new MeshStandardMaterial({
    map: crustTexture(),
    roughness: 0.92,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  const crust = new Mesh(new PlaneGeometry(30, 30), crustMat);
  crust.rotation.x = -Math.PI / 2;
  crust.position.y = -0.0005;
  crust.receiveShadow = true;

  // The gold thread (accent-line, gold-500) as the horizon of the salt pans.
  const horizonMat = new MeshBasicMaterial({
    color: 0xa8823f,
    transparent: true,
    opacity: 0,
    fog: false,
  });
  const horizon = new Mesh(new PlaneGeometry(60, 0.012), horizonMat);
  horizon.position.set(0, 0.02, -9);

  return {
    contact,
    contactMats,
    shadowFloor,
    shadowMat: shadowFloor.material,
    crust,
    crustMat,
    horizon,
    horizonMat,
  };
}
