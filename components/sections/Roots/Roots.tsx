import { Placeholder } from '@/components/Placeholder/Placeholder';
import { SplitText } from '@/components/SplitText/SplitText';
import shell from '../section.module.css';
import styles from './Roots.module.css';

export function Roots() {
  return (
    <section className={shell.blk} id="roots" aria-labelledby="roots-title">
      <div className={`py-wrap ${styles.roots}`}>
        <div className={styles.txt}>
          <p className="py-eyebrow">Our roots</p>
          <SplitText id="roots-title" className="py-display py-d-l">
            Born on the shore of the lake.
          </SplitText>
          <p className="py-lead" data-fade>
            Pyoor packs its salt on Phulera Road, Sambhar, a few kilometres from the pans where it
            crystallises. Salt has been made here by hand for generations; we simply bring it to
            your table without a long journey in between.
          </p>
          <dl className={styles.facts} data-fade>
            <div>
              <dt className="sr-only">Salts at launch</dt>
              <dd>
                <b>2</b>
                <span>salts at launch</span>
              </dd>
            </div>
            <div>
              <dt className="sr-only">Jar size</dt>
              <dd>
                <b>1 kg</b>
                <span>clear jars</span>
              </dd>
            </div>
            <div>
              <dt className="sr-only">Distance</dt>
              <dd>
                <b>0 km</b>
                <span>between lake and packing</span>
              </dd>
            </div>
          </dl>
        </div>
        <Placeholder
          shot="Sambhar Lake salt pans at golden hour, wide"
          ratio="4 / 5"
          parallax={-8}
        />
      </div>
    </section>
  );
}
