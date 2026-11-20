import { getProduct, getProducts } from '@/lib/commerce';
import { OG_SIZE, OG_TYPE, ogImage } from '@/lib/og/image';

export const alt = 'A Pyoor salt from Sambhar Lake';
export const size = OG_SIZE;
export const contentType = OG_TYPE;
export const dynamicParams = false;

const RENDER: Record<string, string> = {
  'herbal-black-salt': '/images/renders/black-studio.webp',
  'natural-lake-salt': '/images/renders/lake-studio.webp',
  'pink-rock-salt': '/images/renders/pink-studio.webp',
};

export async function generateStaticParams() {
  return (await getProducts()).map((p) => ({ handle: p.handle }));
}

export default async function Image({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const p = await getProduct(handle);
  return ogImage({
    eyebrow: 'Pyoor · 1 kg jar or refill pouch',
    title: p?.title ?? 'Pyoor',
    image: RENDER[handle],
  });
}
