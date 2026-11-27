import { OG_SIZE, OG_TYPE, ogImage } from '@/lib/og/image';

export const alt = 'The Pyoor salts from Sambhar Lake';
export const size = OG_SIZE;
export const contentType = OG_TYPE;
export const dynamic = 'force-static';

export default function Image() {
  return ogImage({
    eyebrow: 'Pyoor · Shop',
    title: 'The Salts.',
    image: '/images/renders/pair-studio.webp',
  });
}
