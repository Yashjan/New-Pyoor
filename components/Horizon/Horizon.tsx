import styles from './Horizon.module.css';

/**
 * The gold thread: one 1px accent-line rule, the horizon of the salt pans
 * (design-system/component-Horizon.md). `draw` lets it draw in from the left once,
 * when it scrolls into view (handled by HomeMotion; under reduced motion it just appears).
 */
export function Horizon({ draw = false, className }: { draw?: boolean; className?: string }) {
  return (
    <hr
      className={[styles.horizon, className].filter(Boolean).join(' ')}
      data-draw={draw || undefined}
    />
  );
}
