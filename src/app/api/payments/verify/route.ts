import type { NextRequest } from "next/server";
import { z } from "zod";
import { fail, json, sameOrigin } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { processPayment } from "@/lib/payments";
import { verifyCheckoutSignature } from "@/lib/razorpay";
import { createServiceClient } from "@/lib/supabase/server";

const Body = z.object({
  razorpay_order_id: z.string().min(5).max(64),
  razorpay_payment_id: z.string().min(5).max(64),
  razorpay_signature: z.string().min(10).max(256),
});

/**
 * Called by the browser after Razorpay Checkout reports success.
 * We (1) check the signature, (2) re-fetch the payment from Razorpay, (3) update the DB.
 * If the browser never calls this (closed tab), the webhook does the same work.
 */
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return fail("Bad origin", 403);
  const { user } = await getSession();
  if (!user) return fail("Please log in again.", 401);
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("Invalid payment data.");
  const b = parsed.data;

  if (!verifyCheckoutSignature(b.razorpay_order_id, b.razorpay_payment_id, b.razorpay_signature)) {
    return fail("Payment signature check failed.", 400);
  }

  const db = createServiceClient();
  const { data: order } = await db.from("orders").select("user_id").eq("razorpay_order_id", b.razorpay_order_id).maybeSingle();
  if (!order || order.user_id !== user.id) return fail("Order not found.", 404);

  try {
    const r = await processPayment(b.razorpay_order_id, b.razorpay_payment_id);
    return json({ ok: true, ...r });
  } catch (e) {
    console.error("verify failed", e);
    // Payment may still be completing; the webhook will finish the job.
    return json({ ok: false, pending: true, error: "We're still confirming your payment. It will show in your account shortly." }, 202);
  }
}
