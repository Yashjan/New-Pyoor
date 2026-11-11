import styles from './Placeholder.module.css';

interface PlaceholderProps {
  /** One-line shot description, e.g. "Sambhar Lake salt pans at golden hour, wide". */
  shot: string;
  /** CSS aspect-ratio at the image's final size, so nothing shifts when the photo arrives. */
  ratio: string;
  /** Scroll parallax of the inner label, in percent (HomeMotion). */
  parallax?: number;
  className?: string;
}

/** Labelled stand-in for photography still to be shot (component-Placeholder.md). */
export function Placeholder({ shot, ratio, parallax, className }: PlaceholderProps) {
  return (
    <div
      role="img"
      aria-label={`Photo to shoot: ${shot}`}
      className={[styles.ph, className].filter(Boolean).join(' ')}
      style={{ aspectRatio: ratio }}
      data-parallax={parallax}
    >
      <div className={styles.in} data-parallax-inner>
        <strong>Photo to shoot</strong>
        {shot}
      </div>
    </div>
  );
}
