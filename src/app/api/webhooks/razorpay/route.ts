import type { NextRequest } from "next/server";
import { json } from "@/lib/api";
import { processPayment, recordPaymentFailure } from "@/lib/payments";
import { verifyWebhookSignature } from "@/lib/razorpay";
import { createServiceClient } from "@/lib/supabase/server";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Razorpay webhook. Configure in Razorpay Dashboard → Webhooks with events:
 * payment.captured, order.paid, payment.failed, refund.processed, refund.failed
 */
export async function POST(req: NextRequest) {
  const raw = await req.text();
  if (!verifyWebhookSignature(raw, req.headers.get("x-razorpay-signature"))) {
    return json({ error: "invalid signature" }, 400);
  }
  let event: any;
  try {
    event = JSON.parse(raw);
  } catch {
    return json({ error: "bad json" }, 400);
  }

  const db = createServiceClient();
  const eventId = req.headers.get("x-razorpay-event-id") || `${event.event}:${event.payload?.payment?.entity?.id ?? event.payload?.refund?.entity?.id ?? event.created_at}`;

  // De-duplicate: insert the event id; if it already exists and was processed, stop.
  const { error: insErr } = await db.from("webhook_events").insert({ event_id: eventId, event_type: event.event, payload: event });
  if (insErr) {
    const { data: prev } = await db.from("webhook_events").select("processed_at").eq("event_id", eventId).maybeSingle();
    if (prev?.processed_at) return json({ ok: true, duplicate: true });
  }

  let result = "ignored";
  try {
    const payment = event.payload?.payment?.entity;
    switch (event.event) {
      case "payment.captured":
      case "order.paid": {
        const orderId = payment?.order_id || event.payload?.order?.entity?.id;
        if (orderId && payment?.id) result = (await processPayment(orderId, payment.id)).status;
        break;
      }
      case "payment.failed":
        if (payment?.order_id) {
          await recordPaymentFailure(payment.order_id, payment.error_description || "Payment failed");
          result = "failure_recorded";
        }
        break;
      case "refund.processed":
      case "refund.failed": {
        const refund = event.payload?.refund?.entity;
        if (refund?.id) {
          await db.from("refunds").update({ status: event.event === "refund.processed" ? "processed" : "failed" }).eq("razorpay_refund_id", refund.id);
          result = "refund_updated";
        }
        break;
      }
    }
  } catch (e) {
    if (String(e).includes("Unknown order")) {
      // Not created by this website (e.g. a payment link) — acknowledge so Razorpay stops retrying.
      await db.from("webhook_events").update({ processed_at: new Date().toISOString(), result: "unknown_order" }).eq("event_id", eventId);
      return json({ ok: true, result: "unknown_order" });
    }
    console.error("webhook processing error", e);
    // 500 => Razorpay retries later. processPayment is idempotent, so retries are safe.
    await db.from("webhook_events").update({ result: `error: ${String(e).slice(0, 200)}` }).eq("event_id", eventId);
    return json({ error: "processing failed" }, 500);
  }

  await db.from("webhook_events").update({ processed_at: new Date().toISOString(), result }).eq("event_id", eventId);
  return json({ ok: true, result });
}
