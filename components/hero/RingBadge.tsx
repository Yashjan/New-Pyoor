import styles from './RingBadge.module.css';

const RING_TEXT = 'FROM THE LAKE · TO YOUR TABLE · ';
const R = 40; // text path radius in the 100 × 100 viewBox

/** Rotating gold ring badge with नमक in the centre. Rotation stops for reduced motion. */
export function RingBadge({ className }: { className?: string }) {
  return (
    <div
      className={`${styles.badge} ${className ?? ''}`}
      role="img"
      aria-label="From the lake to your table"
    >
      <svg viewBox="0 0 100 100" className={styles.ring} aria-hidden="true">
        <defs>
          <path
            id="ring-path"
            d={`M50,50 m-${R},0 a${R},${R} 0 1,1 ${R * 2},0 a${R},${R} 0 1,1 -${R * 2},0`}
          />
        </defs>
        <text className={styles.text}>
          <textPath href="#ring-path" textLength={2 * Math.PI * R} lengthAdjust="spacingAndGlyphs">
            {RING_TEXT}
          </textPath>
        </text>
      </svg>
      <span className={`hindi ${styles.center}`} lang="hi" aria-hidden="true">
        नमक
      </span>
    </div>
  );
}
