'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useState } from 'react';
import { MenuIcon, SearchIcon } from '@/components/icons/Icons';
import { useCart } from '@/components/providers/CartProvider';
import { site } from '@/lib/site';
import styles from './Header.module.css';
import { MobileMenu } from './MobileMenu';
import { SearchDialog, type SearchItem } from './SearchDialog';

export function Header({ searchItems }: { searchItems: SearchItem[] }) {
  const { cart, openCart } = useCart();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  const closeSearch = useCallback(() => setSearchOpen(false), []);
  const count = cart?.totalQuantity ?? 0;

  return (
    <>
      <header className={styles.header}>
        <div className={`container ${styles.inner}`}>
          <nav aria-label="Primary" className={styles.nav}>
            <ul>
              {site.nav.map((item) => (
                <li key={item.href}>
                  <Link href={item.href}>{item.label}</Link>
                </li>
              ))}
            </ul>
          </nav>

          <button
            type="button"
            className={`${styles.iconButton} ${styles.menuButton}`}
            aria-haspopup="dialog"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(true)}
          >
            <MenuIcon />
            <span className="visually-hidden">Menu</span>
          </button>

          <Link href="/" className={styles.logo}>
            <Image
              src="/brand/pyoor-logo-gold.png"
              alt="Pyoor home"
              width={1189}
              height={489}
              sizes="120px"
              loading="eager"
            />
          </Link>

          <div className={styles.actions}>
            <button
              type="button"
              className={styles.iconButton}
              aria-haspopup="dialog"
              onClick={() => setSearchOpen(true)}
            >
              <SearchIcon />
              <span className="visually-hidden">Search</span>
            </button>
            <button
              type="button"
              className={styles.cartPill}
              aria-haspopup="dialog"
              onClick={openCart}
            >
              Cart <span aria-hidden="true">({count})</span>
              <span className="visually-hidden">, {count === 1 ? '1 item' : `${count} items`}</span>
            </button>
          </div>
        </div>
      </header>

      <MobileMenu open={menuOpen} onClose={closeMenu} />
      <SearchDialog open={searchOpen} onClose={closeSearch} items={searchItems} />
    </>
  );
}
