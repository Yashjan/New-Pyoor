import { RECIPES, getRecipe, recipeMeta } from '@/lib/content/recipes';
import { OG_SIZE, OG_TYPE, ogImage } from '@/lib/og/image';

export const alt = 'A recipe from the Pyoor kitchen';
export const size = OG_SIZE;
export const contentType = OG_TYPE;
export const dynamicParams = false;

export function generateStaticParams() {
  return RECIPES.map((r) => ({ slug: r.slug }));
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const r = getRecipe((await params).slug)!;
  return ogImage({
    eyebrow: `Recipe · ${recipeMeta(r)}`,
    title: r.name,
    image: `/engravings/recipe-${r.slug}.png`,
  });
}
