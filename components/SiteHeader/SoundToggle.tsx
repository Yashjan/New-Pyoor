'use client';

import { useSyncExternalStore } from 'react';
import { sound } from '@/lib/sound/sound';
import styles from './SiteHeader.module.css';

/** "Sound": off by default, remembered; three small bars that move gently while it's on. */
export function SoundToggle({ className = '' }: { className?: string }) {
  // the server (and hydration) always render "off"; the stored choice follows
  const on = useSyncExternalStore(sound.subscribe, sound.isOn, () => false);
  return (
    <button
      type="button"
      className={`${styles.sound} ${on ? styles.soundOn : ''} ${className}`}
      aria-pressed={on}
      onClick={() => sound.set(!on)}
    >
      Sound
      <span className={styles.bars} aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
    </button>
  );
}
