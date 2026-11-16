import { notFound } from 'next/navigation';
import { Studio } from './Studio';

/**
 * Development only (404 in production): the product renders' studio, driven by
 * tools/3d/render_products.mjs. Not linked anywhere.
 */
export default function StudioPage() {
  if (process.env.NODE_ENV !== 'development') notFound();
  return <Studio />;
}
