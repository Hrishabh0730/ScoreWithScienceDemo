import type { NextRequest } from "next/server";
import { z } from "zod";
import { fail, json, sameOrigin } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { RAZORPAY_KEY_ID, paymentsStatus } from "@/lib/config";
import { razorpay } from "@/lib/razorpay";
import { createServiceClient } from "@/lib/supabase/server";

const Body = z.object({ noteIds: z.array(z.string().uuid()).min(1).max(50) });

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return fail("Bad origin", 403);
  const pay = paymentsStatus();
  if (!pay.ok) return fail("Online payments are not switched on yet. Please contact us.", 503);

  const { user, profile } = await getSession();
  if (!user) return fail("Please log in to buy notes.", 401);

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("Invalid cart.");
  const ids = [...new Set(parsed.data.noteIds)];

  const db = createServiceClient();
  // Prices come from the database — never from the browser.
  const { data: notes, error } = await db
    .from("notes")
    .select("id, title, price_paise, is_published, is_available, class_level, board, note_files(note_id)")
    .in("id", ids);
  if (error) return fail("Could not load notes.", 500);

  const unavailable = ids.filter((id) => {
    const n = notes?.find((x) => x.id === id);
    const hasFile = Array.isArray(n?.note_files) ? n.note_files.length > 0 : Boolean(n?.note_files);
    return !n || !n.is_published || !n.is_available || !hasFile;
  });
  if (unavailable.length) return fail("Some notes in your cart are no longer available.", 409, { unavailable });

  const { data: owned } = await db
    .from("order_items")
    .select("note_id, orders!inner(user_id, status)")
    .in("note_id", ids)
    .eq("orders.user_id", user.id)
    .eq("orders.status", "paid");
  const ownedIds = [...new Set((owned ?? []).map((o) => o.note_id))];
  if (ownedIds.length) return fail("You already own some of these notes — find them in your account.", 409, { owned: ownedIds });

  const items = notes!;
  const amount = items.reduce((s, n) => s + n.price_paise, 0);

  const { data: orderNumber } = await db.rpc("make_ref", { p_prefix: "SWS-N" });
  const { data: order, error: oe } = await db
    .from("orders")
    .insert({ order_number: orderNumber, user_id: user.id, kind: "notes", amount_paise: amount })
    .select("id, order_number")
    .single();
  if (oe || !order) return fail("Could not create order.", 500);

  const { error: ie } = await db.from("order_items").insert(
    items.map((n) => ({ order_id: order.id, note_id: n.id, title_snapshot: `${n.title} (Class ${n.class_level} ${n.board})`, price_paise: n.price_paise })),
  );
  if (ie) return fail("Could not create order items.", 500);

  try {
    const rzpOrder = await razorpay().orders.create({
      amount,
      currency: "INR",
      receipt: order.order_number,
      notes: { order_number: order.order_number, kind: "notes" },
    });
    await db.from("orders").update({ razorpay_order_id: rzpOrder.id }).eq("id", order.id);
    return json({
      keyId: RAZORPAY_KEY_ID,
      razorpayOrderId: rzpOrder.id,
      amount,
      currency: "INR",
      orderNumber: order.order_number,
      description: `${items.length} chapter${items.length > 1 ? "s" : ""} of notes`,
      prefill: { name: profile?.full_name || undefined, email: user.email, contact: profile?.phone || undefined },
      mode: pay.mode,
    });
  } catch (e) {
    await db.from("orders").update({ status: "cancelled", last_error: String(e).slice(0, 300) }).eq("id", order.id);
    return fail("Payment gateway error. Please try again in a minute.", 502);
  }
}
