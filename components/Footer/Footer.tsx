import Image from 'next/image';
import Link from 'next/link';
import type { Product } from '@/lib/commerce';
import { site } from '@/lib/site';
import styles from './Footer.module.css';
import { NewsletterForm } from './NewsletterForm';

export function Footer({ products }: { products: Pick<Product, 'handle' | 'title'>[] }) {
  const { company } = site;
  const tel = company.phone.replace(/\s/g, '');

  return (
    <footer className={styles.footer}>
      <div className={`container ${styles.top}`}>
        <div className={styles.brand}>
          <Image
            src="/brand/pyoor-logo-gold.png"
            alt="Pyoor"
            width={1189}
            height={489}
            sizes="140px"
            className={styles.logo}
          />
          <p className={styles.line}>
            Salt from Sambhar Lake, Rajasthan, harvested, crafted and packed on its shores.
          </p>
          <NewsletterForm />
        </div>

        <nav aria-label="Shop" className={styles.col}>
          <h2 className={styles.colTitle}>Shop</h2>
          <ul>
            {products.map((p) => (
              <li key={p.handle}>
                <Link href={`/product/${p.handle}`}>{p.title}</Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label="Pyoor" className={styles.col}>
          <h2 className={styles.colTitle}>Pyoor</h2>
          <ul>
            {site.nav
              .filter((item) => item.label !== 'Shop')
              .map((item) => (
                <li key={item.href}>
                  <Link href={item.href}>{item.label}</Link>
                </li>
              ))}
          </ul>
        </nav>

        <div className={styles.col}>
          <h2 className={styles.colTitle}>Contact</h2>
          <address className={styles.address}>
            {company.legalName}
            <br />
            {company.address.street}
            <br />
            {company.address.locality}, {company.address.region} {company.address.postalCode}
          </address>
          <ul>
            <li>
              <a href={`tel:${tel}`}>{company.phone}</a>
            </li>
            <li>
              <a href={`mailto:${company.email}`} className={styles.email}>
                {company.email}
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div className={`container ${styles.bottom}`}>
        <p>
          © {new Date().getFullYear()} {company.legalName}
          <span aria-hidden="true"> · </span>
          <br className={styles.mobileBreak} />
          FSSAI Lic. No. {company.fssaiLicence}
        </p>
        <p className={styles.disclaimer}>{site.brandNameDisclaimer}</p>
      </div>
    </footer>
  );
}
