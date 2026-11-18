import Link from 'next/link';
import { SplitText } from '@/components/SplitText/SplitText';
import { asset } from '@/lib/basePath';
import { FireMotion } from './FireMotion';
import styles from './Fire.module.css';

/** The five frames (tools/engravings/fire.mjs) and their words. [CONFIRM COPY] No claims. */
export const FIRE_STEPS = [
  {
    alt: 'White lake salt heaped in a shallow brass vessel',
    text: 'It begins with salt from our own lake. Sambhar salt, the same white crystals you saw in the pans.',
  },
  {
    alt: 'Hands mixing the salt with harad, baheda and amla fruits and strips of babul bark',
    text: 'Then the fruits and the bark. Harad, baheda and amla, with babul bark, are mixed in by hand.',
  },
  {
    alt: 'A row of round clay pots with sealed mouths set into a low earthen kiln, the bhatti',
    text: 'Sealed in clay. The salt goes into clay pots, closed tight, and into the bhatti.',
  },
  {
    alt: 'The bhatti burning, stacked cow-dung cakes around the pots, flames rising',
    text: 'Thirty-two hours. A slow, steady fire of cow-dung cakes, the way it has always been done. Inside the pots, the white salt melts and turns black.',
  },
  {
    alt: 'Dark glassy lumps of salt on a cloth, one broken with a stone, ground grains beside it',
    text: 'Broken by hand. When it cools, the salt is glassy and dark. Our family breaks it, grinds it, and it turns the soft pinkish-brown of kala namak, with its unmistakable taste.',
  },
] as const;

/**
 * 05 · The fire: how the black salt is made, after the products. Pinned and scrubbed
 * (FireMotion): five engraved frames draw in turn, the hours of fire count up, the bhatti burns.
 * Without motion (reduced motion, no JS): the five frames stacked with their words.
 */
export function Fire() {
  return (
    <section className={styles.fire} id="fire" aria-labelledby="fire-title" data-fire>
      <div className={styles.stage}>
        <div className={styles.txt}>
          <p className={styles.chapter}>05 · The fire</p>
          <SplitText id="fire-title" className={`py-display py-d-l ${styles.title}`}>
            Thirty-two hours of fire.
          </SplitText>
          <div className={styles.counter} aria-hidden="true">
            <span className={styles.hours} data-fire-hours>
              00 h
            </span>
            <span className={styles.hoursLabel}>hours of fire</span>
          </div>
          <p className={styles.still}>32 hours of fire</p>
          {/* the words for the frame on screen (the figures' captions carry them for readers) */}
          <div className={styles.texts} aria-hidden="true">
            {FIRE_STEPS.map((s, i) => (
              <p key={i} className={styles.text} data-fire-text={i}>
                {s.text}
              </p>
            ))}
          </div>
          <Link className={styles.shop} href="/#shop" data-fire-shop>
            Shop Herbal Black Salt <span aria-hidden="true">→</span>
          </Link>
        </div>
        <div className={styles.box} data-fire-box>
          <div className={styles.glow} aria-hidden="true" data-fire-glow>
            <span />
          </div>
          {FIRE_STEPS.map((s, i) => (
            <figure key={i} className={styles.frame} data-fire-frame={i}>
              <div className={styles.art} data-fire-art={i + 1}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={asset(`/engravings/fire-${i + 1}.svg`)}
                  alt={s.alt}
                  loading="lazy"
                  decoding="async"
                />
              </div>
              <figcaption className={styles.caption}>{s.text}</figcaption>
            </figure>
          ))}
        </div>
      </div>
      <FireMotion />
    </section>
  );
}
