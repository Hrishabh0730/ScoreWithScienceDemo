import type { Metadata } from "next";
import Link from "next/link";
import { Notice } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { fmtDateTime, inr } from "@/lib/format";
import { BOOKING_STATUS_LABEL } from "@/lib/types";
import { RefreshSoon } from "./RefreshSoon";

export const metadata: Metadata = { title: "Payment status", robots: { index: false } };

export default async function Complete({ searchParams }: { searchParams: Promise<{ order?: string }> }) {
  const sp = await searchParams;
  const { supabase } = await requireUser("/account");
  const { data: order } = await supabase
    .from("orders")
    .select("id, order_number, kind, status, amount_paise, paid_at, order_items(title_snapshot), bookings(booking_number, status, service, slots(start_at, end_at))")
    .eq("order_number", sp.order ?? "")
    .maybeSingle();

  if (!order) {
    return (
      <div className="container-x max-w-2xl py-16">
        <h1 className="h-section">Order not found</h1>
        <Link href="/account" className="btn-primary mt-6">Go to my account</Link>
      </div>
    );
  }
  const booking = (order.bookings as unknown as { booking_number: string; status: string; service: string; slots: { start_at: string } | null }[])?.[0];
  const pending = order.status === "created";
  const success = order.status === "paid";

  return (
    <div className="container-x max-w-2xl py-16">
      {pending && <RefreshSoon />}
      <div className="card p-8">
        <p className="eyebrow">{success ? "Payment successful" : pending ? "Confirming payment" : "Payment received"}</p>
        <h1 className="mt-2 text-3xl font-extrabold text-navy-900">
          {success ? (order.kind === "notes" ? "Your notes are ready 🎉" : "Your class is booked 🎉") : pending ? "Just a moment…" : "We're reviewing your booking"}
        </h1>
        <dl className="mt-6 grid gap-3 text-sm sm:grid-cols-2">
          <Row k="Order ID" v={order.order_number} />
          <Row k="Amount" v={inr(order.amount_paise)} />
          {order.paid_at && <Row k="Paid on" v={fmtDateTime(order.paid_at)} />}
          {booking && <Row k="Booking ID" v={booking.booking_number} />}
          {booking?.slots && <Row k="Session" v={`${booking.service === "tuition" ? "Tuition" : "Doubt session"} · ${fmtDateTime(booking.slots.start_at)} IST`} />}
          {booking && <Row k="Booking status" v={BOOKING_STATUS_LABEL[booking.status] ?? booking.status} />}
        </dl>
        {order.kind === "notes" && success && (
          <ul className="mt-6 list-disc space-y-1 pl-5 text-sm text-ink">
            {(order.order_items as { title_snapshot: string }[]).map((i) => (
              <li key={i.title_snapshot}>{i.title_snapshot}</li>
            ))}
          </ul>
        )}
        <div className="mt-6">
          {pending && <Notice tone="info">We haven&apos;t received confirmation from the payment gateway yet. If money was deducted, this page will update automatically within a few minutes — you never need to pay twice.</Notice>}
          {order.status === "needs_review" && (
            <Notice tone="warn">
              Your payment arrived, but the slot was no longer available when it completed (or something needs checking). We&apos;ll contact you to reschedule or refund in full.
            </Notice>
          )}
        </div>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/account" className="btn-primary">{order.kind === "notes" ? "Download my notes" : "View my bookings"}</Link>
          <Link href={`/account/receipt/${order.order_number}`} className="btn-outline">View receipt</Link>
        </div>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-xl bg-navy-50/70 p-3">
      <dt className="text-xs font-bold uppercase tracking-wide text-muted">{k}</dt>
      <dd className="mt-0.5 font-semibold text-navy-900">{v}</dd>
    </div>
  );
}
