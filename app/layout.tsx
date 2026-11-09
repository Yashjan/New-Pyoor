import type { Metadata, Viewport } from 'next';
import { Cormorant_Garamond, Manrope, Tiro_Devanagari_Hindi } from 'next/font/google';
import { getSiteUrl, site } from '@/lib/site';
import './globals.css';

const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  style: ['normal', 'italic'],
  variable: '--font-cormorant',
  display: 'swap',
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

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-IN" className={`${cormorant.variable} ${manrope.variable} ${tiro.variable}`}>
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
