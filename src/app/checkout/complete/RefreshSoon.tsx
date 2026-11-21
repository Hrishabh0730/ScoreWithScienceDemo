"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Polls while a payment is still being confirmed by the webhook. */
export function RefreshSoon({ every = 4000 }: { every?: number }) {
  const router = useRouter();
  useEffect(() => {
    let n = 0;
    const t = setInterval(() => {
      if (++n > 40) return clearInterval(t);
      router.refresh();
    }, every);
    return () => clearInterval(t);
  }, [router, every]);
  return null;
}
