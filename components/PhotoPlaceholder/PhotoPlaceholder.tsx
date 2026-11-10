import { CameraIcon } from '@/components/icons/Icons';
import styles from './PhotoPlaceholder.module.css';

interface PhotoPlaceholderProps {
  /** What to shoot, e.g. "Sambhar Lake salt pans at golden hour". */
  subject: string;
  tone?: 'dark' | 'light';
  /** CSS aspect-ratio, e.g. "4 / 5". Parents can also set `--placeholder-ratio` in CSS. */
  ratio?: string;
  className?: string;
}

/** Clearly labelled stand-in for a photo that has not been shot yet. */
export function PhotoPlaceholder({
  subject,
  tone = 'dark',
  ratio,
  className,
}: PhotoPlaceholderProps) {
  return (
    <div
      role="img"
      aria-label={`Photo placeholder: ${subject}`}
      className={[styles.placeholder, styles[tone], className].filter(Boolean).join(' ')}
      style={ratio ? { aspectRatio: ratio } : undefined}
    >
      <CameraIcon size={28} />
      <span className={styles.text}>
        <span className={styles.kicker}>Photo to shoot</span>
        {subject}
      </span>
    </div>
  );
}
