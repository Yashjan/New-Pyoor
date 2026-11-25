import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { EngravingDraw } from './EngravingDraw';
import styles from './Engraving.module.css';

const cache = new Map<string, string>();
/** public/engravings/{name}.svg, read at build time, its root made an accessible image. */
function inline(name: string, label: string) {
  let svg = cache.get(name);
  if (!svg) {
    svg = readFileSync(join(process.cwd(), 'public/engravings', `${name}.svg`), 'utf8');
    cache.set(name, svg);
  }
  // no label: decoration beside its own words
  if (!label) return svg.replace('<svg ', '<svg aria-hidden="true" focusable="false" ');
  return svg.replace('<svg ', `<svg role="img" aria-label="${label.replace(/"/g, '&quot;')}" `);
}

/**
 * A gold-line engraving, inlined so its lines can draw themselves, in the order they were cut
 * (data-t), when it enters view (EngravingDraw). No JS or reduced motion: fully drawn. The box
 * has a fixed ratio, so nothing shifts.
 */
export function Engraving({
  name,
  label,
  className,
  ratio = '4 / 5',
}: {
  name: string;
  label: string;
  className?: string;
  ratio?: string;
}) {
  return (
    <div className={`${styles.engr} ${className ?? ''}`} style={{ aspectRatio: ratio }} data-engr>
      <div className={styles.svg} dangerouslySetInnerHTML={{ __html: inline(name, label) }} />
      <EngravingDraw />
    </div>
  );
}
