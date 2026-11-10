import Image from 'next/image';
import { ButtonLink } from '@/components/Button/Button';
import styles from './Hero.module.css';
import { RingBadge } from './RingBadge';

interface HeroProps {
  /** e.g. "₹249"; the lowest price among products that can be bought. */
  fromPrice: string | null;
}

/**
 * Static hero (Step 2). The `.stage` box is where the 3D jar canvas mounts in Step 3;
 * until the model is ready the poster image shows there.
 */
export function Hero({ fromPrice }: HeroProps) {
  return (
    <section className={styles.hero} aria-labelledby="hero-title">
      <div className={`container ${styles.grid}`}>
        <div className={styles.copy}>
          <p className={styles.eyebrow}>Sambhar Lake · Rajasthan</p>
          <h1 id="hero-title" className={styles.title}>
            <span>Salt, the way</span> <span>the lake</span> <span>makes it.</span>
          </h1>
          <p className={styles.sub}>
            Black salt and lake salt from India’s largest inland salt lake — harvested, crafted and
            packed on its shores.
          </p>
          <div className={styles.ctas}>
            <ButtonLink href="#shop" variant="primary">
              {fromPrice ? `Shop the salts — from ${fromPrice}` : 'Shop the salts'}
            </ButtonLink>
            <ButtonLink href="#origin" variant="outline">
              Our story
            </ButtonLink>
          </div>
          <ul className={styles.trust}>
            <li>FSSAI licensed</li>
            <li>Batch &amp; dates on every jar</li>
            <li>COD available</li>
          </ul>
        </div>

        <div className={styles.stage}>
          <div className={styles.poster}>
            <Image
              src="/images/jar-black-salt-photo.jpg"
              alt="A 1 kg jar of Pyoor Herbal Black Salt"
              width={1400}
              height={1867}
              sizes="(max-width: 1023px) min(80vw, 352px), 416px"
              fetchPriority="high"
              loading="eager"
              className={styles.posterImg}
            />
          </div>
          <RingBadge className={styles.badge} />
        </div>
      </div>
    </section>
  );
}
