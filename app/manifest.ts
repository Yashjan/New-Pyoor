import type { MetadataRoute } from 'next';
import { asset } from '@/lib/basePath';
import { site } from '@/lib/site';

export const dynamic = 'force-static';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${site.name}: Salt from Sambhar Lake`,
    short_name: site.name,
    description: site.description,
    start_url: asset('/'),
    display: 'browser',
    background_color: '#f5f1e8',
    theme_color: '#f5f1e8',
    icons: [
      { src: asset('/icons/icon-512.png'), sizes: '512x512', type: 'image/png' },
      {
        src: asset('/icons/icon-maskable-512.png'),
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
      { src: asset('/icon.png'), sizes: '192x192', type: 'image/png' },
    ],
  };
}
