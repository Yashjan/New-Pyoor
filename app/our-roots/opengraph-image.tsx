import { OG_SIZE, OG_TYPE, ogImage } from '@/lib/og/image';

export const alt = 'Pyoor: our roots at Sambhar Lake';
export const size = OG_SIZE;
export const contentType = OG_TYPE;
export const dynamic = 'force-static';

export default function Image() {
  return ogImage({
    eyebrow: 'Our roots',
    title: 'Born on the shores of Sambhar.',
    image: '/engravings/page-bench.svg',
  });
}
