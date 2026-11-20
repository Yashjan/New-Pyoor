import { OG_SIZE, OG_TYPE, ogImage } from '@/lib/og/image';

export const alt = 'Pyoor: Terms of sale';
export const size = OG_SIZE;
export const contentType = OG_TYPE;
export const dynamic = 'force-static';

export default function Image() {
  return ogImage({ eyebrow: 'Pyoor', title: 'Terms of sale' });
}
