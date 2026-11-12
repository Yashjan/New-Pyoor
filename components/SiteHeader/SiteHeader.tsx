'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useCart } from '@/components/providers/CartProvider';
import { SiteMenu, type SiteMenuHandle } from '@/components/SiteMenu/SiteMenu';
import { loadGsap } from '@/lib/motion/gsap';
import { scrollToHash } from '@/lib/motion/lenis';
import styles from './SiteHeader.module.css';
import { asset } from '@/lib/basePath';

/**
 * Menu left, logo centred, bag right (design-system/component-SiteHeader.md). Transparent over
 * the hero, blurred ivory after 80px of scroll. The menu (components/SiteMenu) opens under it,
 * so the header stays exactly as it is; only the button's word rolls from Menu to Close.
 * In-page links (/#…) are handed to Lenis by SmoothScroll.
 */
export function SiteHeader() {
  const { cart, openCart, added } = useCart();
  const count = cart?.totalQuantity ?? 0;
  // Bump the bag pill whenever something is added (a new key restarts the animation).
  const bump = added?.id ?? 0;
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const menu = useRef<SiteMenuHandle>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 80);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Magnetic on desktop: the button follows the cursor by up to 6px (the rect is read once,
  // on entering; no layout reads while it moves).
  const box = useRef<DOMRect | null>(null);
  const magnetic = () =>
    window.matchMedia('(hover: hover) and (pointer: fine)').matches &&
    !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const onEnter = (e: React.PointerEvent<HTMLButtonElement>) => {
    void loadGsap(); // the menu's choreography, ready before the click
    box.current = magnetic() ? e.currentTarget.getBoundingClientRect() : null;
  };
  const onMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const b = box.current;
    if (!b) return;
    const k = (v: number) => Math.max(-1, Math.min(1, v));
    const dx = k((e.clientX - (b.left + b.width / 2)) / (b.width / 2)) * 6;
    const dy = k((e.clientY - (b.top + b.height / 2)) / (b.height / 2)) * 6;
    e.currentTarget.style.transform = `translate3d(${dx.toFixed(1)}px, ${dy.toFixed(1)}px, 0)`;
  };
  const onLeave = (e: React.PointerEvent<HTMLButtonElement>) => {
    box.current = null;
    e.currentTarget.style.transform = '';
  };

  const headerClass = [styles.hdr, scrolled && styles.scrolled, open && styles.open]
    .filter(Boolean)
    .join(' ');

  return (
    <>
      <header className={headerClass} data-site-header>
        <button
          ref={menuButton}
          type="button"
          className={styles.menuBtn}
          aria-expanded={open}
          aria-controls="site-menu"
          onClick={() => setOpen(!open)}
          onPointerEnter={onEnter}
          onPointerMove={onMove}
          onPointerLeave={onLeave}
          onFocus={() => void loadGsap()}
        >
          <span className={styles.btnMask} aria-hidden="true">
            <span className={styles.btnRoll}>
              <span>Menu</span>
              <span>Close</span>
            </span>
          </span>
          <i className={styles.dot} aria-hidden="true" />
          <span className="sr-only">Menu</span>
        </button>
        <Link
          className={styles.logo}
          href="/#top"
          aria-label="Pyoor home"
          data-header-logo
          onClick={(e) => {
            if (!open) return;
            e.preventDefault();
            menu.current?.closeThen(() => scrollToHash('#top'));
          }}
        >
          <Image
            src={asset('/brand/pyoor-logo.png')}
            alt=""
            width={629}
            height={264}
            sizes="(max-width: 860px) 81px, 105px"
            loading="eager"
          />
        </Link>
        <div className={styles.end}>
          <button
            type="button"
            key={bump}
            className={`${styles.bag} ${bump ? styles.bump : ''}`}
            aria-haspopup="dialog"
            onClick={() => (open ? menu.current?.closeThen(openCart) : openCart())}
          >
            {/* one flex item: the button's gap would otherwise space out "( 0 )" */}
            <span>
              Bag (<b>{count}</b>)
            </span>
            <span className="sr-only">, {count === 1 ? '1 item' : `${count} items`}</span>
          </button>
        </div>
      </header>

      <SiteMenu ref={menu} open={open} onClose={() => setOpen(false)} button={menuButton} />
    </>
  );
}
