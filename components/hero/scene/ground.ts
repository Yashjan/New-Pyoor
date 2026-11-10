import {
  CanvasTexture,
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

/** Soft shadow under the jar, the salt flats (fade in at the end) and the gold horizon line. */
export function createGround() {
  const shadowFloor = new Mesh(new PlaneGeometry(4, 4), new ShadowMaterial({ opacity: 0.16 }));
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
    shadowFloor,
    shadowMat: shadowFloor.material,
    crust,
    crustMat,
    horizon,
    horizonMat,
  };
}
