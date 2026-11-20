import { OG_SIZE, OG_TYPE, ogImage } from '@/lib/og/image';

export const alt = 'Pyoor: salt from Sambhar Lake';
export const size = OG_SIZE;
export const contentType = OG_TYPE;
export const dynamic = 'force-static';

export default function Image() {
  return ogImage({
    eyebrow: 'Sambhar Lake, Rajasthan',
    title: 'Salt, the way the lake makes it.',
    image: '/images/renders/black-studio.webp',
  });
}
