import { HindiText } from '@/components/HindiText/HindiText';
import styles from './TextureBand.module.css';

const ITEMS = [
  { text: 'Black Salt' },
  { text: 'काला नमक', hindi: true },
  { text: 'Lake Salt' },
  { text: 'सफ़ेद नमक', hindi: true },
];

function Line({ hidden = false }: { hidden?: boolean }) {
  return (
    <p className={styles.line} aria-hidden={hidden || undefined}>
      {ITEMS.map((item, i) => (
        <span key={item.text} className={styles.item}>
          {i > 0 && (
            <span className={styles.diamond} aria-hidden="true">
              ◆
            </span>
          )}
          {item.hindi ? <HindiText>{item.text}</HindiText> : <span>{item.text}</span>}
        </span>
      ))}
      {/* trailing diamond so the marquee loop joins seamlessly */}
      <span className={`${styles.diamond} ${styles.trailing}`} aria-hidden="true">
        ◆
      </span>
    </p>
  );
}

/** 150 px strip over a dark salt-crystal texture. Becomes a slow marquee at ≤ 768 px. */
export function TextureBand() {
  return (
    <div className={styles.band}>
      <div className={styles.track}>
        <Line />
        <Line hidden />
      </div>
    </div>
  );
}
