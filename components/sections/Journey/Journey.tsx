import { Placeholder } from '@/components/Placeholder/Placeholder';
import { SplitText } from '@/components/SplitText/SplitText';
import styles from './Journey.module.css';

const CHAPTERS = [
  {
    title: 'Brine',
    shot: 'Brine channels at dawn',
    text: 'Lake water is let into shallow pans across the flats.',
  },
  {
    title: 'Sun',
    shot: 'Glittering crust in midday sun',
    text: 'The Rajasthan sun and wind slowly evaporate the water until crystals form.',
  },
  {
    title: 'Harvest',
    shot: 'Hands raking salt into mounds',
    text: 'Crystals are raked, gathered into mounds and sun-dried.',
  },
  {
    title: 'Craft',
    shot: 'Harad, baheda and amla',
    text: 'For kala namak, lake salt is processed with harad, baheda and amla. [Confirm full process]',
  },
  {
    title: 'Jar',
    shot: 'Filling and sealing jars',
    text: 'Packed at Sambhar in clear 1 kg jars, each marked with its batch and dates.',
  },
];

/** Five chapters. Pinned and scrolled sideways from 861px (HomeMotion); stacked on phones. */
export function Journey() {
  return (
    <section className={styles.journey} id="journey" aria-labelledby="journey-title">
      <div className={styles.head}>
        <div className={styles.headTitle}>
          <p className="py-eyebrow">The journey</p>
          <SplitText id="journey-title" className="py-display py-d-l">
            From lake to jar, in five steps.
          </SplitText>
        </div>
        <p className={`py-lead ${styles.headLead}`} data-fade>
          Every step happens within reach of the lake.
        </p>
      </div>
      <div className={styles.pin} data-journey-pin>
        <div className={styles.line} aria-hidden="true" />
        <ol className={styles.track} data-journey-track>
          {CHAPTERS.map((c, i) => (
            <li key={c.title} className={styles.chap}>
              <div className={styles.num} aria-hidden="true">
                {String(i + 1).padStart(2, '0')}
              </div>
              <Placeholder shot={c.shot} ratio="5 / 4" />
              <h3 className="py-display py-d-m">{c.title}</h3>
              <p>{c.text}</p>
            </li>
          ))}
        </ol>
        <div className={styles.progress} aria-hidden="true">
          <i data-journey-progress />
        </div>
      </div>
    </section>
  );
}
