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
  /** Adds to the bag and announces it (toast + bag bump); the drawer stays closed. */
  add: (variantId: string, quantity?: number, label?: string) => Promise<void>;
  /** The latest "added" notice; `id` changes on every add so repeats re-trigger. */
  added: { id: number; label: string } | null;
  update: (lineId: string, quantity: number) => Promise<void>;
  remove: (lineId: string) => Promise<void>;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<Cart | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [added, setAdded] = useState<{ id: number; label: string } | null>(null);

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

  const add = useCallback(async (variantId: string, quantity = 1, label = '') => {
    setCart(await addToCart(variantId, quantity));
    setAdded((prev) => ({ id: (prev?.id ?? 0) + 1, label }));
  }, []);

  const update = useCallback(async (lineId: string, quantity: number) => {
    setCart(await updateCartLine(lineId, quantity));
  }, []);

  const remove = useCallback(async (lineId: string) => {
    setCart(await removeFromCart(lineId));
  }, []);

  const value = useMemo(
    () => ({ cart, isOpen, openCart, closeCart, add, added, update, remove }),
    [cart, isOpen, openCart, closeCart, add, added, update, remove],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside <CartProvider>');
  return ctx;
}
