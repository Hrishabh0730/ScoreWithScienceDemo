"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export interface CartItem {
  id: string;
  title: string;
  label: string; // "Class 10 · CBSE · Science"
  price_paise: number; // display only — the server recalculates
}

interface CartCtx {
  items: CartItem[];
  add: (i: CartItem) => void;
  remove: (id: string) => void;
  clear: () => void;
  has: (id: string) => boolean;
  total: number;
  ready: boolean;
}

const Ctx = createContext<CartCtx | null>(null);
const KEY = "sws-cart-v1";

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate from storage once
      if (raw) setItems(JSON.parse(raw));
    } catch {
      /* storage unavailable */
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(items));
    } catch {
      /* ignore */
    }
  }, [items, ready]);

  const add = useCallback((i: CartItem) => setItems((xs) => (xs.some((x) => x.id === i.id) ? xs : [...xs, i])), []);
  const remove = useCallback((id: string) => setItems((xs) => xs.filter((x) => x.id !== id)), []);
  const clear = useCallback(() => setItems([]), []);
  const value = useMemo(
    () => ({
      items,
      add,
      remove,
      clear,
      has: (id: string) => items.some((x) => x.id === id),
      total: items.reduce((s, x) => s + x.price_paise, 0),
      ready,
    }),
    [items, add, remove, clear, ready],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCart() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useCart outside CartProvider");
  return c;
}
