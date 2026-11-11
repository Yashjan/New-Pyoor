import Image from 'next/image';
import Link from 'next/link';
import { site } from '@/lib/site';
import styles from './Footer.module.css';
import { NewsletterForm } from './NewsletterForm';
import { asset } from '@/lib/basePath';

/** Navy footer with the logo on its ivory crest (concept.html). Copy is the prototype's. */
export function Footer() {
  const { company } = site;
  return (
    <footer className={styles.footer} data-theme="navy">
      <div className={styles.top}>
        <Link className={styles.crest} href="/#top" aria-label="Back to top">
          <Image
            src={asset('/brand/pyoor-logo.png')}
            alt=""
            width={629}
            height={264}
            sizes="110px"
          />
        </Link>
      </div>
      <div className={styles.grid}>
        <div>
          <p className={styles.big}>
            From the lake, <span className="py-italic">to your table.</span>
          </p>
          <NewsletterForm />
        </div>
        <div>
          <h2 className={styles.h}>Shop</h2>
          <Link href="/product/herbal-black-salt">Herbal Black Salt</Link>
          <Link href="/product/natural-lake-salt">Natural Lake Salt</Link>
          {/* [CONFIRM] Amazon listing URL */}
          <Link href="/#shop">Buy on Amazon</Link>
        </div>
        <div>
          <h2 className={styles.h}>Pyoor</h2>
          <Link href="/#roots">Our roots</Link>
          <Link href="/#journey">The journey</Link>
          <Link href="/#recipes">Recipes</Link>
        </div>
        <div>
          <h2 className={styles.h}>Contact</h2>
          <p className={styles.contact}>
            {company.legalName}
            <br />
            58-R, Shiv Vihar Colony, Phulera Road, Sambhar Lake, Jaipur, Rajasthan 303604
            <br />
            <br />
            <a href={`tel:${company.phone.replace(/\s/g, '')}`}>{company.phone}</a>
          </p>
        </div>
      </div>
      <div className={styles.base}>
        <span>
          © 2026 {company.legalName} · FSSAI Lic. No. {company.fssaiLicence}
        </span>
        <span>{site.brandNameDisclaimer}</span>
      </div>
    </footer>
  );
}
