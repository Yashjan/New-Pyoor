import type { Metadata, Viewport } from 'next';
import { Cormorant_Garamond, Manrope, Tiro_Devanagari_Hindi } from 'next/font/google';
import { AnnouncementBar } from '@/components/AnnouncementBar/AnnouncementBar';
import { CartDrawer } from '@/components/CartDrawer/CartDrawer';
import { Footer } from '@/components/Footer/Footer';
import { Header } from '@/components/Header/Header';
import { CartProvider } from '@/components/providers/CartProvider';
import { getProducts } from '@/lib/commerce';
import { getSiteUrl, site } from '@/lib/site';
import './globals.css';

const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['500', '600'],
  variable: '--font-cormorant',
  display: 'swap',
});

// Italic is only used in the texture band, below the fold: don't preload it.
const cormorantItalic = Cormorant_Garamond({
  subsets: ['latin'],
  weight: '400',
  style: 'italic',
  variable: '--font-cormorant-italic',
  display: 'swap',
  preload: false,
});

const manrope = Manrope({
  subsets: ['latin'],
  variable: '--font-manrope',
  display: 'swap',
});

const tiro = Tiro_Devanagari_Hindi({
  subsets: ['devanagari'],
  weight: '400',
  variable: '--font-tiro',
  display: 'swap',
  // Only used for small Hindi accents; don't block the first paint on it.
  preload: false,
});

export const metadata: Metadata = {
  metadataBase: getSiteUrl(),
  title: {
    default: `${site.name}: Salt from Sambhar Lake`,
    template: `%s · ${site.name}`,
  },
  description: site.description,
  openGraph: {
    type: 'website',
    siteName: site.name,
    locale: 'en_IN',
  },
};

export const viewport: Viewport = {
  themeColor: '#131B3F',
  width: 'device-width',
  initialScale: 1,
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const products = await getProducts();
  const searchItems = products.map(({ handle, title, titleHindi, summary, tags }) => ({
    handle,
    title,
    titleHindi,
    summary,
    keywords: tags.join(' ').replaceAll('-', ' '),
  }));

  return (
    <html
      lang="en-IN"
      className={[
        cormorant.variable,
        cormorantItalic.variable,
        manrope.variable,
        tiro.variable,
      ].join(' ')}
    >
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <CartProvider>
          <AnnouncementBar />
          <Header searchItems={searchItems} />
          {children}
          <Footer products={products} />
          <CartDrawer />
        </CartProvider>
      </body>
    </html>
  );
}
