"use client";
import Link from "next/link";
import { useCart, type CartItem } from "@/components/CartProvider";

export function AddToCart({ item }: { item: CartItem }) {
  const cart = useCart();
  if (cart.ready && cart.has(item.id)) {
    return (
      <div className="flex gap-2">
        <Link href="/cart" className="btn-primary">Go to cart →</Link>
        <button className="btn-ghost" onClick={() => cart.remove(item.id)}>Remove</button>
      </div>
    );
  }
  return (
    <button className="btn-accent" onClick={() => cart.add(item)} disabled={!cart.ready}>
      Add to cart
    </button>
  );
}
