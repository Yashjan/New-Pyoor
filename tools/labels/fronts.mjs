// The jar labels' front panels alone (the label reader while SHOW_FULL_LABEL is false, so the
// side panels with the claims being corrected never show):
//   public/textures/label-<handle>-front.webp, cropped from label-<handle>-4096.webp
//   node tools/labels/fronts.mjs
import sharp from 'sharp';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const T = join(dirname(fileURLToPath(import.meta.url)), '../../public/textures');
/** The front panel, between the gold diagonals (px of the 4096 sheet). */
const FRONT = { left: 1300, width: 1500 };
for (const h of ['herbal-black-salt', 'natural-lake-salt']) {
  const src = sharp(join(T, `label-${h}-4096.webp`));
  const { height } = await src.metadata();
  const out = await src
    .extract({ left: FRONT.left, top: 0, width: FRONT.width, height })
    .webp({ quality: 88 })
    .toFile(join(T, `label-${h}-front.webp`));
  console.log(h, out.width, out.height, Math.round(out.size / 1024) + ' KB');
}
