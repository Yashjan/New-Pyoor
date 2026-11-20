import { OG_SIZE, OG_TYPE, ogImage } from '@/lib/og/image';

export const alt = 'Recipes from the Pyoor kitchen';
export const size = OG_SIZE;
export const contentType = OG_TYPE;
export const dynamic = 'force-static';

export default function Image() {
  return ogImage({
    eyebrow: '07 · Recipes',
    title: 'From our kitchen.',
    image: '/engravings/recipe-masala-chaas.png',
  });
}
