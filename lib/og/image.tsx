import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';
import sharp from 'sharp';

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_TYPE = 'image/png';

const ROOT = process.cwd();
const font = (f: string) => readFile(join(ROOT, 'lib/og', f));

/** A public/ image as a PNG data URL (the renderer reads PNG and JPEG only). */
async function png(path: string, height: number) {
  const buf = await sharp(join(ROOT, 'public', path))
    .resize({ height })
    .png()
    .toBuffer();
  return `data:image/png;base64,${buf.toString('base64')}`;
}

/**
 * A page's share image in the site's style: ivory, the gold horizon with a half-sun setting on
 * it, a small gold eyebrow, the title in Cormorant, and the product or engraving on the right.
 */
export async function ogImage({
  eyebrow,
  title,
  image,
}: {
  eyebrow: string;
  title: string;
  /** public/ path of the picture (a product render or a recipe engraving) */
  image?: string;
}) {
  const [cormorant, manrope, pic] = await Promise.all([
    font('CormorantGaramond-Medium.ttf'),
    font('Manrope-Medium.ttf'),
    image ? png(image, 520) : Promise.resolve(null),
  ]);
  const gold = '#a8823f';
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        position: 'relative',
        background: '#f5f1e8',
        fontFamily: 'Manrope',
      }}
    >
      {/* the horizon and the half-sun */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 500,
          height: 1,
          background: gold,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: pic ? 300 : 840,
          top: 444,
          width: 112,
          height: 56,
          borderTopLeftRadius: 56,
          borderTopRightRadius: 56,
          border: `1px solid ${gold}`,
          borderBottom: 'none',
        }}
      />
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          width: pic ? 640 : 1000,
          padding: '0 0 120px 80px',
        }}
      >
        <div
          style={{
            fontSize: 22,
            letterSpacing: 5,
            color: '#7a5c26',
            textTransform: 'uppercase',
            marginBottom: 24,
          }}
        >
          {eyebrow}
        </div>
        <div
          style={{
            fontFamily: 'Cormorant',
            fontSize: title.length > 28 ? 68 : 84,
            lineHeight: 1.04,
            color: '#18214a',
          }}
        >
          {title}
        </div>
        <div style={{ marginTop: 28, fontSize: 22, color: '#5a6077' }}>
          Pyoor · Salt from Sambhar Lake
        </div>
      </div>
      {pic && (
        <div
          style={{
            display: 'flex',
            flex: 1,
            alignItems: 'flex-end',
            justifyContent: 'center',
            paddingBottom: 130,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={pic} height={400} style={{ objectFit: 'contain' }} alt="" />
        </div>
      )}
    </div>,
    {
      ...OG_SIZE,
      fonts: [
        { name: 'Cormorant', data: cormorant, weight: 500, style: 'normal' },
        { name: 'Manrope', data: manrope, weight: 500, style: 'normal' },
      ],
    },
  );
}
