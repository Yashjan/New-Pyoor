// The square logo Razorpay's checkout shows in its header: the Pyoor logo centred on ivory, 512×512.
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const SIZE = 512;
const logo = await sharp(join(ROOT, 'public/brand/pyoor-logo.png'))
  .resize(Math.round(SIZE * 0.8), Math.round(SIZE * 0.8), { fit: 'inside' })
  .toBuffer();
await sharp({ create: { width: SIZE, height: SIZE, channels: 3, background: '#f5f1e8' } })
  .composite([{ input: logo, gravity: 'center' }])
  .png()
  .toFile(join(ROOT, 'public/brand/razorpay-logo.png'));
