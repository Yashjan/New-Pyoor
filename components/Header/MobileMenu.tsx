'use client';

import Link from 'next/link';
import { useModalDialog } from '@/components/Dialog/useModalDialog';
import { CloseIcon } from '@/components/icons/Icons';
import { site } from '@/lib/site';
import styles from './MobileMenu.module.css';

/** Full-screen navy menu for ≤ 768 px. */
export function MobileMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useModalDialog(open, onClose);

  return (
    <dialog ref={ref} className={styles.menu} aria-label="Menu">
      <div className={styles.top}>
        <button type="button" className={styles.close} onClick={onClose}>
          <CloseIcon />
          <span className="visually-hidden">Close menu</span>
        </button>
      </div>
      <nav aria-label="Mobile">
        <ul className={styles.links}>
          {site.nav.map((item) => (
            <li key={item.href}>
              <Link href={item.href} onClick={onClose}>
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <p className={styles.foot}>
        <span>Packed at Sambhar Lake, Rajasthan</span>
        <a href={`tel:${site.company.phone.replace(/\s/g, '')}`}>{site.company.phone}</a>
      </p>
    </dialog>
  );
}
