import Link from 'next/link';
import { SplitText } from '@/components/SplitText/SplitText';
import { asset } from '@/lib/basePath';
import { LoupeLazy } from './LoupeLazy';
import styles from './Crystals.module.css';

/** The two halves' words (they follow the loupe). [CONFIRM] No claims. */
const SIDES = [
  'Ground fine and pinkish-brown, with the tang of the fire. For chaat, raita, fruit and nimbu pani.',
  'A small, bright crystal, clean and simple. For everyday cooking, the way Sambhar has always cooked.',
] as const;

/** One layer of the field (tools/crystals/render.mjs): AVIF, WebP. */
function Field({ name, className }: { name: 'soft' | 'sharp'; className?: string }) {
  return (
    <picture className={className} data-field={name}>
      {/* phones get a lighter macro (1.5×, ≤ 350 KB) */}
      {name === 'sharp' && (
        <>
          <source
            media="(max-width: 768px)"
            srcSet={asset('/images/crystals/field-sharp-m.avif')}
            type="image/avif"
          />
          <source
            media="(max-width: 768px)"
            srcSet={asset('/images/crystals/field-sharp-m.webp')}
            type="image/webp"
          />
        </>
      )}
      <source srcSet={asset(`/images/crystals/field-${name}.avif`)} type="image/avif" />
      <img
        src={asset(`/images/crystals/field-${name}.webp`)}
        alt=""
        loading="lazy"
        decoding="async"
        draggable={false}
      />
    </picture>
  );
}

/**
 * "Look closer": the two salts side by side, Herbal Black Salt left and Natural Lake Salt right,
 * and a loupe that shows them sharp and magnified (Loupe.tsx). Not pinned. The field is
 * decoration; the two captions are the words.
 */
export function Crystals() {
  return (
    <section
      className={styles.crystals}
      id="crystals"
      data-theme="navy"
      aria-labelledby="crystals-title"
      data-crystals
    >
      <div className={styles.head}>
        <p className="py-eyebrow">Look closer</p>
        <SplitText id="crystals-title" className={`py-display py-d-xl ${styles.title}`}>
          Every grain catches the light.
        </SplitText>
      </div>

      <div
        className={styles.field}
        data-loupe-field
        tabIndex={0}
        aria-label="Magnifier: move it with the arrow keys"
      >
        <div className={styles.world} aria-hidden="true" data-world>
          <Field name="soft" className={styles.layer} />
        </div>
        {/* the loupe(s): the sharp field, magnified 2.5× about the loupe's centre, cut to it */}
        {[0, 1].map((i) => (
          <div key={i} className={styles.lens} aria-hidden="true" data-lens={i}>
            <div className={styles.mag} data-mag>
              <div className={styles.world} data-world>
                <Field name="sharp" className={styles.layer} />
              </div>
            </div>
          </div>
        ))}
        {[0, 1].map((i) => (
          <div key={i} className={styles.ring} aria-hidden="true" data-ring={i}>
            {[0, 1, 2, 3].map((g) => (
              <span key={g} className={styles.glint} style={{ '--g': g } as React.CSSProperties} />
            ))}
          </div>
        ))}
        <p className={`${styles.label} ${styles.labelL}`} aria-hidden="true">
          KALA NAMAK · <span lang="hi">काला नमक</span>
        </p>
        <p className={`${styles.label} ${styles.labelR}`} aria-hidden="true">
          LAKE SALT · <span lang="hi">सांभर नमक</span>
        </p>
      </div>

      <div className={styles.foot}>
        <div className={styles.captions} data-captions>
          {SIDES.map((t, i) => (
            <p key={i} className={styles.caption} data-caption={i}>
              {t}
            </p>
          ))}
        </div>
        <Link className={styles.shop} href="/#shop">
          Shop both <span aria-hidden="true">→</span>
        </Link>
      </div>
      <LoupeLazy />
    </section>
  );
}
