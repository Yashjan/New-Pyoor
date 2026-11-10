'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { addToCart, getCart, removeFromCart, updateCartLine, type Cart } from '@/lib/commerce';

interface CartContextValue {
  /** `null` until the cart has been read from storage on the client. */
  cart: Cart | null;
  isOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  add: (variantId: string, quantity?: number) => Promise<void>;
  update: (lineId: string, quantity: number) => Promise<void>;
  remove: (lineId: string) => Promise<void>;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<Cart | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    let active = true;
    const load = () =>
      getCart().then((c) => {
        if (active) setCart(c);
      });
    load();
    // Keep tabs in sync: another tab changing the cart fires `storage` here.
    window.addEventListener('storage', load);
    return () => {
      active = false;
      window.removeEventListener('storage', load);
    };
  }, []);

  const openCart = useCallback(() => setIsOpen(true), []);
  const closeCart = useCallback(() => setIsOpen(false), []);

  const add = useCallback(async (variantId: string, quantity = 1) => {
    setCart(await addToCart(variantId, quantity));
    setIsOpen(true);
  }, []);

  const update = useCallback(async (lineId: string, quantity: number) => {
    setCart(await updateCartLine(lineId, quantity));
  }, []);

  const remove = useCallback(async (lineId: string) => {
    setCart(await removeFromCart(lineId));
  }, []);

  const value = useMemo(
    () => ({ cart, isOpen, openCart, closeCart, add, update, remove }),
    [cart, isOpen, openCart, closeCart, add, update, remove],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside <CartProvider>');
  return ctx;
}
