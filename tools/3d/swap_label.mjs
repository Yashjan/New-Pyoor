// Puts a new label image into the herbal black salt jar, in place (no rebuild of the model):
//   node tools/3d/swap_label.mjs <label.png>
// - tools/3d/source/pyoor-herbal-black-salt.glb   the source model (JPEG q90, as build_jar.py)
// - public/models/pyoor-herbal-black-salt.glb     the web model (WebP q72: inside the 600 KB budget;
//                                                 meshopt geometry re-encoded as it was)
// and the web model's hash in lib/three/models.ts. Called by tools/3d/label_textures.py, which
// makes the image (2400 px, the model's size). (npm run models gives the same result from source.)
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import sharp from 'sharp';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync, statSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const png = process.argv[2];
if (!png) throw new Error('usage: node tools/3d/swap_label.mjs <label.png>');

await MeshoptDecoder.ready;
await MeshoptEncoder.ready;
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });

const labelTexture = (doc) => {
  const mat = doc
    .getRoot()
    .listMaterials()
    .find((m) => m.getName() === 'Label');
  const tex = mat?.getBaseColorTexture();
  if (!tex) throw new Error('no Label base colour texture');
  return tex;
};

for (const [path, encode, mime] of [
  ['tools/3d/source/pyoor-herbal-black-salt.glb', (s) => s.jpeg({ quality: 90 }), 'image/jpeg'],
  [
    'public/models/pyoor-herbal-black-salt.glb',
    (s) => s.webp({ quality: 72, effort: 6 }),
    'image/webp',
  ],
]) {
  const file = join(ROOT, path);
  const doc = await io.read(file);
  const tex = labelTexture(doc);
  tex.setImage(await encode(sharp(png)).toBuffer()).setMimeType(mime);
  await io.write(file, doc);
  console.log(path, `${(statSync(file).size / 1024).toFixed(0)} KB`);
}

// the web model's content hash (its cache-busting URL, as compress.sh writes it)
const web = join(ROOT, 'public/models/pyoor-herbal-black-salt.glb');
const hash = createHash('sha256').update(readFileSync(web)).digest('hex').slice(0, 10);
const ts = join(ROOT, 'lib/three/models.ts');
writeFileSync(
  ts,
  readFileSync(ts, 'utf8').replace(
    /('pyoor-herbal-black-salt\.glb': ')[0-9a-f]+(')/,
    `$1${hash}$2`,
  ),
);
console.log('lib/three/models.ts', hash);
