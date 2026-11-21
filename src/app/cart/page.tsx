"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useCart } from "@/components/CartProvider";
import { Notice } from "@/components/ui";
import { useRazorpay } from "@/components/useRazorpay";
import { inr } from "@/lib/format";

export default function CartPage() {
  const cart = useCart();
  const router = useRouter();
  const pay = useRazorpay();
  const [owned, setOwned] = useState<string[]>([]);
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "error" | "warn" | "info"; text: string } | null>(null);

  useEffect(() => {
    fetch("/api/notes/owned")
      .then((r) => r.json())
      .then((j) => {
        setOwned(j.owned || []);
        setLoggedIn(Boolean(j.loggedIn));
      })
      .catch(() => setLoggedIn(false));
  }, []);

  const payable = cart.items.filter((i) => !owned.includes(i.id));
  const total = payable.reduce((s, i) => s + i.price_paise, 0);

  async function checkout() {
    setMsg(null);
    if (!loggedIn) return router.push("/login?next=/cart");
    setBusy(true);
    try {
      const res = await fetch("/api/notes/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ noteIds: payable.map((i) => i.id) }),
      });
      const j = await res.json();
      if (!res.ok) {
        if (res.status === 401) return router.push("/login?next=/cart");
        if (j.unavailable) j.unavailable.forEach((id: string) => cart.remove(id));
        if (j.owned) setOwned((o) => [...o, ...j.owned]);
        setMsg({ tone: "error", text: j.error || "Could not start checkout." });
        return;
      }
      let result;
      let failure = "";
      try {
        result = await pay(
          { keyId: j.keyId, razorpayOrderId: j.razorpayOrderId, amount: j.amount, currency: j.currency, description: j.description, prefill: j.prefill },
          (m) => {
            failure = m;
            setMsg({ tone: "warn", text: `Payment failed: ${m}. You can retry in the payment window.` });
          },
        );
      } catch (e) {
        if ((e as Error).message === "dismissed") {
          setMsg(
            failure
              ? { tone: "error", text: `Payment failed: ${failure}. No money was taken — please try again or use another payment method.` }
              : { tone: "info", text: "Payment window closed. No money was taken unless you completed the payment — if you did, your notes will appear in your account shortly." },
          );
        } else setMsg({ tone: "error", text: (e as Error).message });
        return;
      }
      const v = await fetch("/api/payments/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(result) });
      const vj = await v.json().catch(() => ({}));
      cart.clear();
      router.push(`/checkout/complete?order=${encodeURIComponent(j.orderNumber)}${vj.ok ? "" : "&pending=1"}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container-x max-w-3xl py-12">
      <h1 className="h-section">Your cart</h1>
      {!cart.ready ? null : cart.items.length === 0 ? (
        <div className="card mt-8 p-10 text-center">
          <p className="font-bold text-navy-900">Your cart is empty.</p>
          <Link href="/notes" className="btn-accent mt-5">Browse notes</Link>
        </div>
      ) : (
        <>
          <ul className="card mt-8 divide-y divide-line">
            {cart.items.map((i) => {
              const isOwned = owned.includes(i.id);
              return (
                <li key={i.id} className="flex items-center justify-between gap-4 p-4 sm:p-5">
                  <div>
                    <p className="font-bold text-navy-900">{i.title}</p>
                    <p className="text-sm text-muted">{i.label}</p>
                    {isOwned && <p className="mt-1 text-xs font-semibold text-teal-700">You already own this — it won&apos;t be charged.</p>}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`font-bold ${isOwned ? "text-muted line-through" : "text-navy-900"}`}>{inr(i.price_paise)}</span>
                    <button className="btn-ghost btn-sm" onClick={() => cart.remove(i.id)} aria-label={`Remove ${i.title}`}>
                      Remove
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="card mt-6 p-5">
            <div className="flex items-center justify-between text-lg">
              <span className="font-semibold text-muted">Total to pay</span>
              <span className="text-3xl font-extrabold text-navy-900">{inr(total)}</span>
            </div>
            <p className="mt-2 text-xs text-muted">
              Final amount is confirmed by our server before payment. Pay by UPI, card, net banking or wallet via Razorpay.
            </p>
            {msg && <div className="mt-4"><Notice tone={msg.tone}>{msg.text}</Notice></div>}
            <button className="btn-accent mt-5 w-full sm:w-auto" onClick={checkout} disabled={busy || payable.length === 0 || loggedIn === null}>
              {busy ? "Please wait…" : loggedIn === false ? "Log in to checkout" : `Pay ${inr(total)}`}
            </button>
            <p className="mt-3 text-xs text-muted">
              By paying you agree to our <Link className="underline" href="/policies/notes">notes purchase policy</Link> and{" "}
              <Link className="underline" href="/policies/refunds">refund policy</Link>.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
