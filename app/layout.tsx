import type { Metadata, Viewport } from 'next';
import { Cormorant_Garamond, Manrope, Tiro_Devanagari_Hindi } from 'next/font/google';
import { BagToast } from '@/components/BagToast/BagToast';
import { CartDrawer } from '@/components/CartDrawer/CartDrawer';
import { Footer } from '@/components/Footer/Footer';
import { SmoothScroll } from '@/components/motion/SmoothScroll';
import { CartProvider } from '@/components/providers/CartProvider';
import { SiteHeader } from '@/components/SiteHeader/SiteHeader';
import { getSiteUrl, site } from '@/lib/site';
import './globals.css';

// Brand book §4: Cormorant Garamond 500 + 500 italic, Manrope 400/500/600, Tiro Devanagari 400.
const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: '500',
  style: ['normal', 'italic'],
  variable: '--font-cormorant',
  display: 'swap',
});

const manrope = Manrope({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-manrope',
  display: 'swap',
});

const tiro = Tiro_Devanagari_Hindi({
  subsets: ['devanagari'],
  weight: '400',
  variable: '--font-tiro',
  display: 'swap',
  // Only Hindi product names use it, below the fold: don't block the first paint on it.
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
  themeColor: '#f5f1e8',
  width: 'device-width',
  initialScale: 1,
};

/**
 * Runs before first paint:
 * - `html.motion` switches on the scroll-driven layouts (pinned hero, horizontal journey).
 *   Without JS, or with prefers-reduced-motion, the class is never added and every section
 *   lays out as a normal static page.
 * - On the homepage, `html[data-intro]="full"` plays the opening (components/opening) on every
 *   load, refreshes included. Reduced motion and no JS get no data-intro: the filled word,
 *   fades only.
 */
const HEAD_FLAGS = `try{var d=document.documentElement,m=!matchMedia('(prefers-reduced-motion: reduce)').matches;if(m){d.classList.add('motion');if(location.pathname==='/')d.setAttribute('data-intro','full')}}catch(e){}`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    // The head flags set <html>'s class and data-intro before React hydrates.
    <html
      lang="en-IN"
      className={[cormorant.variable, manrope.variable, tiro.variable].join(' ')}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: HEAD_FLAGS }} />
      </head>
      {/* Browser extensions (e.g. ColorZilla's `cz-shortcut-listen`) add attributes to <body>
          before React hydrates. This only ignores attribute differences on <body> itself;
          mismatches anywhere inside it are still reported. */}
      <body suppressHydrationWarning>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <CartProvider>
          <SiteHeader />
          {children}
          <Footer />
          <CartDrawer />
          <BagToast />
        </CartProvider>
        <SmoothScroll />
      </body>
    </html>
  );
}
