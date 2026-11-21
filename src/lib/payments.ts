import "server-only";
import { fetchAndCapturePayment } from "@/lib/razorpay";
import { createServiceClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email";
import { fmtDateTime, inr } from "@/lib/format";
import { SITE_URL } from "@/lib/config";

export interface ProcessResult {
  kind: "notes" | "booking";
  status: string; // paid | confirmed | needs_review | already_processed:...
  orderNumber: string;
  bookingNumber?: string;
}

/**
 * Single source of truth for "a payment happened". Called from both the browser
 * callback (after signature check) and the webhook. Safe to call many times.
 */
export async function processPayment(razorpayOrderId: string, paymentId: string): Promise<ProcessResult> {
  const db = createServiceClient();
  const { data: order, error } = await db
    .from("orders")
    .select("id, order_number, kind, amount_paise, user_id, status")
    .eq("razorpay_order_id", razorpayOrderId)
    .maybeSingle();
  if (error) throw error;
  if (!order) throw new Error("Unknown order");

  // Verify with Razorpay's API: right order, captured, INR.
  const payment = await fetchAndCapturePayment(paymentId);
  if (payment.order_id !== razorpayOrderId) throw new Error("Payment does not belong to this order");
  if (payment.status !== "captured") throw new Error(`Payment not captured (status: ${payment.status})`);
  if (payment.currency !== "INR") throw new Error("Unexpected currency");

  if (order.kind === "notes") {
    const { data: status, error: e } = await db.rpc("mark_notes_order_paid", {
      p_order: order.id,
      p_payment_id: payment.id,
      p_amount_paise: payment.amount,
      p_method: payment.method ?? null,
    });
    if (e) throw e;
    if (status === "paid") void notifyNotesPaid(order.id).catch(() => {});
    return { kind: "notes", status: String(status), orderNumber: order.order_number };
  }

  const { data: booking, error: be } = await db
    .from("bookings")
    .select("id, booking_number")
    .eq("order_id", order.id)
    .maybeSingle();
  if (be) throw be;
  if (!booking) throw new Error("Booking for order not found");
  const { data: status, error: ce } = await db.rpc("confirm_booking_payment", {
    p_booking: booking.id,
    p_payment_id: payment.id,
    p_amount_paise: payment.amount,
    p_method: payment.method ?? null,
  });
  if (ce) throw ce;
  if (status === "confirmed" || status === "needs_review") void notifyBooking(booking.id).catch(() => {});
  return { kind: "booking", status: String(status), orderNumber: order.order_number, bookingNumber: booking.booking_number };
}

export async function recordPaymentFailure(razorpayOrderId: string, reason: string) {
  const db = createServiceClient();
  await db
    .from("orders")
    .update({ last_error: reason.slice(0, 300) })
    .eq("razorpay_order_id", razorpayOrderId)
    .eq("status", "created");
}

async function notifyNotesPaid(orderId: string) {
  const db = createServiceClient();
  const { data } = await db
    .from("orders")
    .select("order_number, amount_paise, profiles(email, full_name), order_items(title_snapshot)")
    .eq("id", orderId)
    .single();
  const p = data?.profiles as unknown as { email: string; full_name: string } | null;
  if (!data || !p?.email) return;
  const items = (data.order_items as { title_snapshot: string }[]).map((i) => `<li>${escapeHtml(i.title_snapshot)}</li>`).join("");
  await sendEmail(
    p.email,
    `Your notes are ready – order ${data.order_number}`,
    `<p>Hi ${escapeHtml(p.full_name || "there")},</p><p>Thank you! Payment of <b>${inr(data.amount_paise)}</b> received for order <b>${data.order_number}</b>.</p><ul>${items}</ul><p>Download any time from <a href="${SITE_URL}/account">your account</a>.</p><p>— ScoreWithScience</p>`,
  );
}

async function notifyBooking(bookingId: string) {
  const db = createServiceClient();
  const { data } = await db
    .from("bookings")
    .select("booking_number, status, service, amount_paise, slots(start_at, end_at), profiles(email, full_name)")
    .eq("id", bookingId)
    .single();
  const p = data?.profiles as unknown as { email: string; full_name: string } | null;
  const s = data?.slots as unknown as { start_at: string } | null;
  if (!data || !p?.email || !s) return;
  const what = data.service === "tuition" ? "Chemistry tuition" : "Chemistry doubt session";
  const body =
    data.status === "confirmed"
      ? `<p>Your ${what} on <b>${fmtDateTime(s.start_at)}</b> (IST) is <b>confirmed</b>. Booking ID: <b>${data.booking_number}</b>. Amount paid: ${inr(data.amount_paise)}.</p><p>The class link will appear in <a href="${SITE_URL}/account">your account</a> before the session.</p>`
      : `<p>We received your payment of ${inr(data.amount_paise)} for booking <b>${data.booking_number}</b>, but the time slot was no longer available when the payment completed. We will contact you to reschedule or refund in full.</p>`;
  await sendEmail(p.email, `Booking ${data.booking_number} – ${data.status === "confirmed" ? "confirmed" : "payment received"}`, `<p>Hi ${escapeHtml(p.full_name || "there")},</p>${body}<p>— ScoreWithScience</p>`);
}

export function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
