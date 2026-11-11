import { SplitText } from '@/components/SplitText/SplitText';
import shell from '../section.module.css';
import styles from './Crystals.module.css';

/** The one immersive navy moment: a close-up of the crystals. */
export function Crystals() {
  return (
    <section
      className={`${shell.blk} ${styles.crystals}`}
      id="crystals"
      data-theme="navy"
      aria-labelledby="crystals-title"
    >
      <div className={styles.bg} aria-hidden="true" data-crystals-bg />
      <div className={styles.veil} aria-hidden="true" />
      <div className={`py-wrap ${styles.copy}`}>
        <p className="py-eyebrow">Look closer</p>
        <SplitText id="crystals-title" className="py-display py-d-xl">
          Every grain catches the light.
        </SplitText>
        <p className="py-lead" data-fade>
          Kala namak is ground fine, so it dissolves into a chaat in seconds. Lake salt keeps a
          small, bright crystal.
        </p>
      </div>
    </section>
  );
}
