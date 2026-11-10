import { BatchIcon, JarIcon, LakeIcon, PayIcon } from '@/components/icons/Icons';
import styles from './TrustRow.module.css';

const ITEMS = [
  {
    Icon: LakeIcon,
    title: 'Packed at the source',
    text: 'Filled and sealed on the shores of Sambhar Lake.',
  },
  {
    Icon: BatchIcon,
    title: 'Traceable jars',
    text: 'Batch number, manufacture and best-before dates on every jar.',
  },
  { Icon: PayIcon, title: 'Pay your way', text: 'UPI, cards, netbanking or COD.' },
  { Icon: JarIcon, title: 'Shatter-proof jars', text: 'Clear PET jars with a screw cap.' },
];

export function TrustRow() {
  return (
    <section className={styles.section} aria-labelledby="trust-title">
      <h2 id="trust-title" className="visually-hidden">
        Why buy from Pyoor
      </h2>
      <ul className={`container ${styles.list}`}>
        {ITEMS.map(({ Icon, title, text }) => (
          <li key={title} className={styles.item} data-reveal>
            <Icon size={32} className={styles.icon} />
            <h3 className={styles.title}>{title}</h3>
            <p className={styles.text}>{text}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
