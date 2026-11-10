import { PhotoPlaceholder } from '@/components/PhotoPlaceholder/PhotoPlaceholder';
import { SectionHeading } from '@/components/SectionHeading/SectionHeading';
import styles from './Origin.module.css';

export function Origin() {
  return (
    <section id="origin" className={styles.section} aria-labelledby="origin-title">
      <div className={`container ${styles.grid}`}>
        <div className={styles.media} data-reveal>
          <PhotoPlaceholder subject="Sambhar Lake salt pans at golden hour" />
        </div>
        <div className={styles.copy}>
          <SectionHeading id="origin-title" eyebrow="The origin" title="Sambhar Lake" />
          <div className={styles.text} data-reveal>
            <p>
              A shallow salt lake in the heart of Rajasthan, worked by hand for generations. Its
              brine is drawn into open pans and left to the sun until crystals form.
            </p>
            <p>
              Pyoor is based on its shores, on Phulera Road — so every jar is packed a few
              kilometres from where the salt was made.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
