import Image from 'next/image';
import Link from 'next/link';
import { SAMBHAR } from '@/components/opening/sambharGlyphs';
import { site } from '@/lib/site';
import { BackToTop } from './BackToTop';
import { FooterEngrave } from './FooterEngrave';
import { NewsletterForm } from './NewsletterForm';
import styles from './Footer.module.css';

const SHOP = [
  { href: '/shop/herbal-black-salt', label: 'Herbal Black Salt' },
  { href: '/shop/natural-lake-salt', label: 'Natural Lake Salt' },
  { href: '/shop/pink-rock-salt', label: 'Pink Rock Salt' },
  { href: '/shop?format=pouch', label: 'Pouches' },
];
const PYOOR = [
  { href: '/our-roots', label: 'Our roots' },
  { href: '/the-journey', label: 'The journey' },
  { href: '/recipes', label: 'Recipes' },
  { href: '/contact', label: 'Contact' },
];
const HELP = [
  { href: '/shipping', label: 'Shipping' },
  { href: '/returns', label: 'Returns' },
  { href: '/faq', label: 'FAQ' },
  { href: '/privacy', label: 'Privacy' },
  { href: '/terms', label: 'Terms' },
];

const [vx, vy, vw, vh] = SAMBHAR.viewBox;

/**
 * The footer, on warm sand: a horizon with a half-sun setting on it, four columns, the word
 * SAMBHAR engraved in gold hairlines (FooterEngrave draws it once when it comes into view), and
 * the bottom bar. No JS or reduced motion: the word is fully drawn.
 */
export function Footer() {
  const { company } = site;
  return (
    <footer className={styles.footer} data-footer>
      <svg className={styles.horizon} viewBox="0 0 64 30" aria-hidden="true">
        <path d="M4 29 A28 28 0 0 1 60 29" />
      </svg>
      <div className={styles.inner}>
        <div className={styles.grid}>
          <div className={styles.brand}>
            <Link href="/#top" className={styles.logo} aria-label="Pyoor home">
              <Image
                src={'/brand/pyoor-logo.png'}
                alt=""
                width={629}
                height={264}
                sizes="140px"
              />
            </Link>
            <p className={styles.tag}>Salt from the shores of Sambhar.</p>
            <p className={styles.place}>
              Sambhar Lake, Rajasthan · <span lang="hi">सांभर</span>
            </p>
          </div>
          <nav aria-labelledby="footer-shop">
            <h2 id="footer-shop" className={styles.h}>
              Shop
            </h2>
            <ul className={styles.links}>
              {SHOP.map((l) => (
                <li key={l.label}>
                  <Link href={l.href}>{l.label}</Link>
                </li>
              ))}
            </ul>
          </nav>
          <nav aria-labelledby="footer-pyoor">
            <h2 id="footer-pyoor" className={styles.h}>
              Pyoor
            </h2>
            <ul className={styles.links}>
              {PYOOR.map((l) => (
                <li key={l.label}>
                  <Link href={l.href}>{l.label}</Link>
                </li>
              ))}
            </ul>
          </nav>
          <div>
            <h2 className={styles.h}>Letters from the lake</h2>
            <NewsletterForm />
            <p className={styles.social}>
              <a href={site.whatsapp.url} target="_blank" rel="noopener noreferrer">
                WhatsApp <span aria-hidden="true">↗</span>
              </a>
              <a href={site.instagram} target="_blank" rel="noopener noreferrer">
                Instagram <span aria-hidden="true">↗</span>
              </a>
            </p>
          </div>
        </div>

        <div className={styles.word} aria-hidden="true" data-footer-word>
          <p className={styles.hindi} lang="hi">
            सांभर
          </p>
          <svg viewBox={`${vx} ${vy} ${vw} ${vh}`} className={styles.sambhar}>
            {SAMBHAR.letters.map((l, i) => (
              <path
                key={i}
                d={l.outer + l.counters.join('')}
                fillRule="evenodd"
                pathLength={1}
                style={{ '--i': i } as React.CSSProperties}
              />
            ))}
          </svg>
          <FooterEngrave />
        </div>

        <div className={styles.base}>
          <p className={styles.legal}>
            <span>© 2026 {company.legalName}</span>
            <span>FSSAI Lic. No. {company.fssaiLicence}</span>
            {HELP.map((l) => (
              <Link key={l.label} href={l.href}>
                {l.label}
              </Link>
            ))}
            <span>{site.brandNameDisclaimer}</span>
          </p>
          <BackToTop className={styles.top} />
        </div>
      </div>
    </footer>
  );
}
