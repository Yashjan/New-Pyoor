'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useCart } from '@/components/providers/CartProvider';
import { lenisStore } from '@/lib/motion/lenis';
import styles from './SiteHeader.module.css';

const NAV = [
  { href: '/#shop', label: 'Shop' },
  { href: '/#roots', label: 'Our roots' },
  { href: '/#journey', label: 'Journey' },
];
const MENU = [
  { href: '/#shop', label: 'Shop' },
  { href: '/#roots', label: 'Our roots' },
  { href: '/#journey', label: 'The journey' },
  { href: '/#recipes', label: 'Recipes' },
];
const MENU_ANIM_MS = 600;

/**
 * Navigation left, logo centred, Recipes + bag right (design-system/component-SiteHeader.md,
 * concept.html). Transparent over the hero, blurred ivory after 80px of scroll. Under 861px the
 * nav moves into a full-screen navy menu and the logo sits on its ivory crest.
 * In-page links (/#…) are handed to Lenis by SmoothScroll.
 */
export function SiteHeader() {
  const { cart, openCart, added } = useCart();
  const count = cart?.totalQuantity ?? 0;
  // Bump the bag pill whenever something is added (a new key restarts the animation).
  const bump = added?.id ?? 0;
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [menuMounted, setMenuMounted] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 80);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const setMenu = useCallback((next: boolean) => {
    setOpen(next);
    if (next) setMenuMounted(true);
  }, []);

  // Menu open: keep focus inside, pause scrolling, hide the page from assistive tech.
  useEffect(() => {
    const page = [document.getElementById('main'), document.querySelector('footer')];
    if (open) {
      lenisStore.get()?.stop();
      page.forEach((el) => el?.setAttribute('inert', ''));
      requestAnimationFrame(() => menuRef.current?.querySelector('a')?.focus());
      const onKey = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          setMenu(false);
          menuButton.current?.focus();
        }
      };
      window.addEventListener('keydown', onKey);
      return () => window.removeEventListener('keydown', onKey);
    }
    lenisStore.get()?.start();
    page.forEach((el) => el?.removeAttribute('inert'));
    const t = window.setTimeout(() => setMenuMounted(false), MENU_ANIM_MS);
    return () => window.clearTimeout(t);
  }, [open, setMenu]);

  // Leaving phone width with the menu open: close it.
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 861px)');
    const onChange = () => mq.matches && setMenu(false);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [setMenu]);

  const headerClass = [styles.hdr, scrolled && styles.scrolled, open && styles.menuOpen]
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
          onClick={() => setMenu(!open)}
        >
          {open ? 'Close' : 'Menu'}
        </button>
        <nav aria-label="Main" className={styles.nav}>
          {NAV.map((item) => (
            <Link key={item.href} href={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>
        <Link className={styles.logo} href="/#top" aria-label="Pyoor home" data-header-logo>
          <Image
            src="/brand/pyoor-logo.png"
            alt=""
            width={629}
            height={264}
            sizes="(max-width: 860px) 81px, 105px"
            loading="eager"
          />
        </Link>
        <div className={styles.end}>
          <Link href="/#recipes" className={styles.endLink}>
            Recipes
          </Link>
          <button
            type="button"
            key={bump}
            className={`${styles.bag} ${bump ? styles.bump : ''}`}
            aria-haspopup="dialog"
            onClick={openCart}
          >
            {/* one flex item: the button's gap would otherwise space out "( 0 )" */}
            <span>
              Bag (<b>{count}</b>)
            </span>
            <span className="sr-only">, {count === 1 ? '1 item' : `${count} items`}</span>
          </button>
        </div>
      </header>

      <div
        id="site-menu"
        ref={menuRef}
        className={`${styles.menu} ${open ? styles.menuShown : ''}`}
        data-theme="navy"
        hidden={!menuMounted && !open}
      >
        <nav aria-label="Menu">
          {MENU.map((item) => (
            <Link key={item.href} href={item.href} onClick={() => setMenu(false)}>
              {item.label}
            </Link>
          ))}
        </nav>
        <p className="py-eyebrow">Sambhar Lake · Rajasthan</p>
      </div>
    </>
  );
}
