import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SplitText } from '@/components/SplitText/SplitText';
import { asset } from '@/lib/basePath';
import { PostmarkDate } from './PostmarkDate';
import { RootsMotion } from './RootsMotion';
import styles from './Roots.module.css';

/** The founder's signature (public/brand/signature.svg, fill currentColor), inlined. */
const SIGNATURE = readFileSync(join(process.cwd(), 'public/brand/signature.svg'), 'utf8').replace(
  / role="img"| aria-label="[^"]*"/g,
  ' aria-hidden="true"',
);
const WHATSAPP = 'https://wa.me/917665009882';
/** A simple leaf-and-sun emblem (not the logo), for the wax seal. */
function Emblem() {
  return (
    <g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <circle cx="32" cy="25" r="7" />
      {Array.from({ length: 8 }, (_, i) => {
        const a = (i / 8) * Math.PI * 2;
        return (
          <line
            key={i}
            x1={32 + Math.cos(a) * 10}
            y1={25 + Math.sin(a) * 10}
            x2={32 + Math.cos(a) * 14}
            y2={25 + Math.sin(a) * 14}
          />
        );
      })}
      <path d="M20 46 C 26 34, 38 34, 44 46 C 38 50, 26 50, 20 46 Z" />
      <path d="M22 46 L42 46" />
    </g>
  );
}

/** The wax seal: one disc, drawn twice (the two halves either side of the crack). */
function Wax() {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <radialGradient id="roots-wax" cx="38%" cy="34%" r="70%">
          <stop offset="0" stopColor="#d9ad5f" />
          <stop offset="0.35" stopColor="#b8893f" />
          <stop offset="1" stopColor="#8a6326" />
        </radialGradient>
      </defs>
      <path
        d="M32 2 C40 3 44 1 50 6 C56 10 61 14 61 22 C63 29 60 34 62 40 C61 48 55 53 50 57 C44 61 38 62 32 62 C25 63 19 60 14 57 C8 53 3 47 3 40 C1 33 4 28 2 22 C4 14 8 9 14 6 C20 2 25 3 32 2 Z"
        fill="url(#roots-wax)"
      />
      <circle cx="32" cy="32" r="21" fill="none" stroke="#8a6326" strokeWidth="1.2" opacity="0.6" />
      <g color="#6e4c18" opacity="0.75">
        <Emblem />
      </g>
      <ellipse cx="22" cy="16" rx="9" ry="4" fill="#fff6dc" opacity="0.35" />
    </svg>
  );
}

/**
 * 06 · Our roots: "A letter from Sambhar". An envelope arrives, its wax seal cracks, the flap
 * opens and the founder's letter unfolds (RootsMotion, pinned and scrubbed). The letter is the
 * real text, in reading order; the envelope and seal are decoration. Without motion: the open
 * letter, signed.
 */
export function Roots() {
  return (
    <section className={styles.roots} id="roots" aria-labelledby="roots-title" data-roots>
      <div className={styles.stage}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className={styles.backdrop}
          src={asset('/engravings/journey-far.svg')}
          alt=""
          aria-hidden="true"
          loading="lazy"
          decoding="async"
        />
        <header className={styles.head} data-roots-head>
          <p className={styles.chapter}>06 · Our roots</p>
          <SplitText id="roots-title" className={`py-display py-d-l ${styles.title}`}>
            A letter from Sambhar.
          </SplitText>
        </header>

        <div className={styles.scene}>
          {/* the envelope: behind the letter (back), in front of it (pocket), the flap and seal */}
          <div className={styles.env} aria-hidden="true" data-env>
            <div className={styles.envBack} />
          </div>

          <article className={styles.letter} data-letter aria-label="A letter from Sambhar">
            <div className={`${styles.panel} ${styles.p1}`} data-panel="1">
              <div className={styles.face}>
                <p className={styles.place} data-line>
                  Sambhar Lake, Rajasthan
                  <span lang="hi" className={styles.hindi}>
                    सांभर
                  </span>
                </p>
                <p className={styles.note} data-line>
                  Pyoor packs its salt on Phulera Road, Sambhar, a few kilometres from the pans
                  where it crystallises.
                </p>
              </div>
              <div className={styles.back} />
            </div>
            <div className={`${styles.panel} ${styles.p2}`} data-panel="2">
              <div className={styles.face}>
                <p className={styles.note} data-line>
                  Salt has been made here by hand for generations; we simply bring it to your table
                  without a long journey in between.
                </p>
              </div>
            </div>
            <div className={`${styles.panel} ${styles.p3}`} data-panel="3">
              <div className={styles.face}>
                <div
                  className={styles.signature}
                  role="img"
                  aria-label="Yash Jangid signature"
                  data-sign
                  dangerouslySetInnerHTML={{ __html: SIGNATURE }}
                />
                <p className={styles.byline} data-line>
                  Yash Jangid, Founder, Pyoor
                </p>
                {/* [CONFIRM COPY] */}
                <p className={styles.ps} data-line>
                  P.S. Come and see the lake when the pans turn pink.
                </p>
              </div>
              <div className={styles.back} />
            </div>
          </article>

          <div className={styles.envFront} aria-hidden="true" data-env-front>
            <div className={styles.pocket}>
              <p className={styles.to}>To you, wherever you are.</p>
              {/* the stamp, engraved: the lake's outline, ₹5, भारत INDIA [CONFIRM ok] */}
              <svg className={styles.stamp} viewBox="0 0 60 72">
                <rect x="1" y="1" width="58" height="70" fill="#f5f1e8" />
                {/* the perforated edge: the envelope's navy bitten out all round */}
                <g fill="#141a3a">
                  {Array.from({ length: 10 }, (_, i) => (
                    <g key={i}>
                      <circle cx={3 + i * 6} cy="1" r="1.8" />
                      <circle cx={3 + i * 6} cy="71" r="1.8" />
                    </g>
                  ))}
                  {Array.from({ length: 12 }, (_, i) => (
                    <g key={i}>
                      <circle cx="1" cy={3 + i * 6} r="1.8" />
                      <circle cx="59" cy={3 + i * 6} r="1.8" />
                    </g>
                  ))}
                </g>
                <g fill="none" stroke="#a8823f" strokeWidth="0.8">
                  <rect x="5" y="5" width="50" height="62" />
                  <path d="M14 30 C18 20 30 18 38 22 C46 26 48 34 42 40 C36 46 24 46 18 42 C13 39 12 34 14 30 Z" />
                  <path d="M18 32 L40 30 M20 37 L38 35" strokeWidth="0.5" />
                </g>
                <text x="8" y="16" fontSize="8" fill="#a8823f" fontFamily="serif">
                  ₹5
                </text>
                <text
                  x="30"
                  y="61"
                  fontSize="5.2"
                  fill="#a8823f"
                  textAnchor="middle"
                  fontFamily="serif"
                >
                  भारत INDIA
                </text>
              </svg>
              {/* the postmark over it */}
              <svg className={styles.postmark} viewBox="0 0 100 100">
                <defs>
                  <path id="roots-ring" d="M50 50 m-34 0 a34 34 0 1 1 68 0 a34 34 0 1 1 -68 0" />
                </defs>
                <g fill="none" stroke="#c7a25a" strokeWidth="1">
                  <circle cx="50" cy="50" r="44" />
                  <circle cx="50" cy="50" r="26" />
                  {[0, 1, 2, 3].map((i) => (
                    <path
                      key={i}
                      d={`M-30 ${38 + i * 8} q 10 -4 20 0 t 20 0 t 20 0 t 20 0`}
                      strokeWidth="0.8"
                    />
                  ))}
                </g>
                <text fontSize="8.4" fill="#c7a25a" letterSpacing="1.2" fontFamily="sans-serif">
                  <textPath href="#roots-ring">SAMBHAR LAKE · 303604 ·</textPath>
                </text>
                <PostmarkDate />
              </svg>
            </div>
          </div>
          {/* the flap: over everything while closed, behind the letter once open */}
          <div className={styles.flap} aria-hidden="true" data-flap>
            <div className={styles.flapFace} />
            {/* the seal on the flap's tip: two halves along an irregular crack */}
            <div className={styles.seal} data-seal>
              <div className={`${styles.half} ${styles.halfL}`} data-seal-half="l">
                <Wax />
              </div>
              <div className={`${styles.half} ${styles.halfR}`} data-seal-half="r">
                <Wax />
              </div>
              <svg className={styles.crack} viewBox="0 0 64 64">
                <path d="M30 2 L34 14 L28 24 L35 33 L29 43 L33 53 L31 62" data-crack />
              </svg>
              {[0, 1, 2, 3, 4].map((i) => (
                <span key={i} className={styles.crumb} data-crumb={i} />
              ))}
            </div>
          </div>
        </div>

        <a
          className={styles.write}
          href={WHATSAPP}
          target="_blank"
          rel="noopener noreferrer"
          data-write
        >
          Write back to us <span aria-hidden="true">→</span>
        </a>
      </div>
      <RootsMotion />
    </section>
  );
}
