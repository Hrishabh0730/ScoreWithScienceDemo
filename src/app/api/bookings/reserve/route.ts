import type { NextRequest } from "next/server";
import { z } from "zod";
import { fail, json, sameOrigin, slotErrorMessage } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { RAZORPAY_KEY_ID, paymentsStatus } from "@/lib/config";
import { fmtDateTime, minutesLabel } from "@/lib/format";
import { razorpay } from "@/lib/razorpay";
import { createServiceClient } from "@/lib/supabase/server";

const Body = z.object({
  slotId: z.string().uuid(),
  service: z.enum(["tuition", "doubt"]),
  classLevel: z.union([z.literal(8), z.literal(9), z.literal(10)]),
  board: z.enum(["CBSE", "ICSE"]),
  topic: z.string().max(500).optional(),
});

/**
 * Steps 4–6: the DATABASE validates and locks the slot (reserve_slot),
 * then we create a Razorpay order for the server-computed amount.
 */
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return fail("Bad origin", 403);
  const pay = paymentsStatus();
  if (!pay.ok) return fail("Online booking payments are not switched on yet. Please contact us to book.", 503);

  const { user, profile, supabase } = await getSession();
  if (!user || !supabase) return fail("Please log in to book.", 401);

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("Please choose class, board and a slot.");
  const b = parsed.data;

  // Runs as the student: auth.uid() is enforced inside the function.
  const { data: booking, error } = await supabase
    .rpc("reserve_slot", { p_slot: b.slotId, p_service: b.service, p_class: b.classLevel, p_board: b.board, p_topic: b.topic ?? null })
    .single<{ id: string; booking_number: string; amount_paise: number; hold_expires_at: string; slot_id: string }>();
  if (error || !booking) return fail(slotErrorMessage(error?.message ?? ""), 409);

  const db = createServiceClient();
  const release = () => db.from("bookings").update({ status: "released" }).eq("id", booking.id).eq("status", "pending_payment");

  try {
    const { data: slot } = await db.from("slots").select("start_at, duration_minutes").eq("id", booking.slot_id).single();
    const { data: orderNumber } = await db.rpc("make_ref", { p_prefix: "SWS-B" });
    const { data: order, error: oe } = await db
      .from("orders")
      .insert({ order_number: orderNumber, user_id: user.id, kind: "booking", amount_paise: booking.amount_paise })
      .select("id, order_number")
      .single();
    if (oe || !order) throw oe ?? new Error("order insert failed");

    const rzpOrder = await razorpay().orders.create({
      amount: booking.amount_paise,
      currency: "INR",
      receipt: order.order_number,
      notes: { order_number: order.order_number, booking_number: booking.booking_number, kind: "booking" },
    });
    await db.from("orders").update({ razorpay_order_id: rzpOrder.id }).eq("id", order.id);
    await db.from("bookings").update({ order_id: order.id }).eq("id", booking.id);

    const secondsLeft = Math.floor((new Date(booking.hold_expires_at).getTime() - Date.now()) / 1000);
    const what = b.service === "tuition" ? "Chemistry tuition" : "Chemistry doubt session";
    return json({
      keyId: RAZORPAY_KEY_ID,
      razorpayOrderId: rzpOrder.id,
      amount: booking.amount_paise,
      currency: "INR",
      orderNumber: order.order_number,
      bookingId: booking.id,
      bookingNumber: booking.booking_number,
      holdExpiresAt: booking.hold_expires_at,
      timeoutSeconds: Math.max(60, secondsLeft - 20),
      description: slot ? `${what} · ${minutesLabel(slot.duration_minutes)} · ${fmtDateTime(slot.start_at)}` : what,
      prefill: { name: profile?.full_name || undefined, email: user.email, contact: profile?.phone || undefined },
      mode: pay.mode,
    });
  } catch (e) {
    console.error("reserve: payment setup failed", e);
    await release();
    return fail("Payment gateway error. Your slot was not charged — please try again.", 502);
  }
}
