import Image from 'next/image';
import styles from './page.module.css';

/** Step 1 placeholder. Replaced by the full homepage in Step 2. */
export default function HomePage() {
  return (
    <main id="main" className={styles.main}>
      <div className={styles.inner}>
        <Image
          className={styles.logo}
          src="/brand/pyoor-logo-gold.png"
          alt="Pyoor"
          width={1189}
          height={489}
          priority
        />
        <p className="label">Sambhar Lake · Rajasthan</p>
        <h1 className={styles.title}>Salt, the way the lake makes it.</h1>
        <p className={styles.sub}>
          Herbal black salt <span className="hindi">काला नमक</span> and natural lake salt{' '}
          <span className="hindi">सफ़ेद नमक</span>, packed at the source.
        </p>
      </div>
    </main>
  );
}
