import { SectionHeading } from '@/components/SectionHeading/SectionHeading';
import styles from './Process.module.css';

const STEPS = [
  {
    title: 'Brine',
    text: 'Lake water is drawn into shallow pans on the shore of Sambhar Lake.',
  },
  {
    title: 'Harvest',
    text: 'The sun evaporates the brine until salt crystals form, which are raked and gathered from the pans.',
  },
  {
    title: 'Craft',
    text: 'Lake salt is sun-dried. For black salt, it is crafted with harad, baheda and amla. [Confirm full process]',
  },
  {
    title: 'Pack',
    text: 'Packed into 1 kg jars on the shores of the lake, with batch and dates printed on every jar.',
  },
];

export function Process() {
  return (
    <section id="process" className={styles.section} aria-labelledby="process-title">
      <div className="container">
        <SectionHeading
          id="process-title"
          tone="light"
          eyebrow="Our process"
          title="From lake to jar"
        />
        <ol className={styles.steps}>
          {STEPS.map((step, i) => (
            <li key={step.title} className={styles.step} data-reveal>
              <span className={styles.number} aria-hidden="true">
                {String(i + 1).padStart(2, '0')}
              </span>
              <h3 className={styles.title}>{step.title}</h3>
              <p className={styles.text}>{step.text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
