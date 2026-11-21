"use client";
import { useCallback } from "react";

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    Razorpay?: any;
  }
}

export interface CheckoutOrder {
  keyId: string;
  razorpayOrderId: string;
  amount: number;
  currency: string;
  description: string;
  prefill?: { name?: string; email?: string; contact?: string };
  timeoutSeconds?: number;
}

export interface CheckoutResult {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

function loadScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") return resolve(false);
    if (window.Razorpay) return resolve(true);
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

/** Opens Razorpay's official Checkout. Resolves on success, rejects on close/failure. */
export function useRazorpay() {
  return useCallback(async (o: CheckoutOrder, onFailed?: (msg: string) => void) => {
    const ok = await loadScript();
    if (!ok) throw new Error("Could not load the payment window. Check your connection and try again.");
    return new Promise<CheckoutResult>((resolve, reject) => {
      const rzp = new window.Razorpay({
        key: o.keyId,
        amount: o.amount,
        currency: o.currency,
        order_id: o.razorpayOrderId,
        name: "ScoreWithScience",
        description: o.description,
        image: `${window.location.origin}/logo.png`,
        prefill: o.prefill,
        theme: { color: "#1b3663" },
        timeout: o.timeoutSeconds,
        handler: (resp: CheckoutResult) => resolve(resp),
        modal: { ondismiss: () => reject(new Error("dismissed")), confirm_close: true },
      });
      rzp.on("payment.failed", (resp: any) => onFailed?.(resp?.error?.description || "Payment failed"));
      rzp.open();
    });
  }, []);
}
