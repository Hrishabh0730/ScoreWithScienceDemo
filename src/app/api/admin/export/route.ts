import type { NextRequest } from "next/server";
import { fail } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { toCsv } from "@/lib/csv";

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function GET(req: NextRequest) {
  const { supabase, profile } = await getSession();
  if (!supabase || profile?.role !== "admin") return fail("Forbidden", 403);
  const type = req.nextUrl.searchParams.get("type");
  let csv = "";
  if (type === "bookings") {
    const { data } = await supabase
      .from("bookings")
      .select("booking_number, status, service, class_level, board, topic, amount_paise, created_at, confirmed_at, meeting_link, profiles(full_name, email, phone), slots(start_at, end_at), orders(order_number, razorpay_payment_id)")
      .order("created_at", { ascending: false })
      .limit(10000);
    csv = toCsv(
      (data ?? []).map((b: any) => ({
        ...b,
        amount_inr: b.amount_paise / 100,
        student: b.profiles?.full_name,
        email: b.profiles?.email,
        phone: b.profiles?.phone,
        start_ist: b.slots?.start_at ? new Date(b.slots.start_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) : "",
        order_number: b.orders?.order_number,
        payment_id: b.orders?.razorpay_payment_id,
      })),
      ["booking_number", "status", "service", "class_level", "board", "start_ist", "student", "email", "phone", "topic", "amount_inr", "order_number", "payment_id", "meeting_link", "created_at", "confirmed_at"],
    );
  } else if (type === "orders") {
    const { data } = await supabase
      .from("orders")
      .select("order_number, kind, status, amount_paise, created_at, paid_at, razorpay_order_id, razorpay_payment_id, payment_method, profiles(full_name, email), order_items(title_snapshot)")
      .order("created_at", { ascending: false })
      .limit(10000);
    csv = toCsv(
      (data ?? []).map((o: any) => ({ ...o, amount_inr: o.amount_paise / 100, student: o.profiles?.full_name, email: o.profiles?.email, items: (o.order_items ?? []).map((i: any) => i.title_snapshot).join("; ") })),
      ["order_number", "kind", "status", "amount_inr", "items", "student", "email", "payment_method", "razorpay_order_id", "razorpay_payment_id", "created_at", "paid_at"],
    );
  } else if (type === "students") {
    const { data } = await supabase.from("profiles").select("full_name, email, phone, class_level, board, created_at").eq("role", "student").order("created_at", { ascending: false }).limit(10000);
    csv = toCsv(data ?? [], ["full_name", "email", "phone", "class_level", "board", "created_at"]);
  } else return fail("Unknown export type");

  const date = new Date().toISOString().slice(0, 10);
  return new Response("﻿" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="scorewithscience-${type}-${date}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
