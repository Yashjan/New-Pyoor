import { OG_SIZE, OG_TYPE, ogImage } from '@/lib/og/image';

export const alt = 'Pyoor: from Sambhar Lake to your kitchen';
export const size = OG_SIZE;
export const contentType = OG_TYPE;
export const dynamic = 'force-static';

export default function Image() {
  return ogImage({
    eyebrow: 'The journey',
    title: 'From the lake to your kitchen.',
    image: '/engravings/scene-3.svg',
  });
}
