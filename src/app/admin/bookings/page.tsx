import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { fmtDateTime, inr, minutesLabel } from "@/lib/format";
import { BOOKING_STATUS_LABEL } from "@/lib/types";
import { refundOrder, updateBooking } from "../actions";
import { ConfirmButton } from "../ConfirmButton";
import { AdminHeader, Flash, type SP } from "../ui";

interface Row {
  id: string;
  booking_number: string;
  service: string;
  status: string;
  class_level: number;
  board: string;
  topic: string | null;
  amount_paise: number;
  meeting_link: string | null;
  admin_note: string | null;
  created_at: string;
  order_id: string | null;
  profiles: { full_name: string; email: string; phone: string | null } | null;
  slots: { start_at: string; duration_minutes: number } | null;
  orders: { order_number: string; status: string; razorpay_payment_id: string | null } | null;
}

const FILTERS = [
  ["upcoming", "Upcoming"],
  ["needs_review", "Needs review"],
  ["pending_payment", "Paying now"],
  ["past", "Past"],
  ["cancelled", "Cancelled / refunded"],
  ["all", "All"],
] as const;

export default async function Bookings({ searchParams }: { searchParams: SP }) {
  const { supabase } = await requireAdmin();
  const sp = await searchParams;
  const status = FILTERS.some(([k]) => k === sp.status) ? sp.status! : "upcoming";
  const now = new Date().toISOString();
  let q = supabase
    .from("bookings")
    .select("id, booking_number, service, status, class_level, board, topic, amount_paise, meeting_link, admin_note, created_at, order_id, profiles(full_name, email, phone), slots!inner(start_at, duration_minutes), orders(order_number, status, razorpay_payment_id)")
    .order("created_at", { ascending: false })
    .limit(300);
  if (status === "upcoming") q = q.eq("status", "confirmed").gt("slots.start_at", now);
  else if (status === "past") q = q.in("status", ["confirmed", "completed"]).lt("slots.start_at", now);
  else if (status === "cancelled") q = q.in("status", ["cancelled", "refunded"]).not("order_id", "is", null);
  else if (status === "pending_payment") q = q.eq("status", "pending_payment").gt("hold_expires_at", now);
  else if (status === "needs_review") q = q.eq("status", "needs_review");
  else q = q.not("status", "in", "(released,expired)");
  const { data } = await q;
  const rows = ((data ?? []) as unknown as Row[]).sort((a, b) =>
    status === "upcoming" ? +new Date(a.slots!.start_at) - +new Date(b.slots!.start_at) : 0,
  );
  const ret = `/admin/bookings?status=${status}`;

  return (
    <>
      <AdminHeader title="Bookings" lead="Confirmed classes, payments in progress and anything that needs your decision.">
        <a href="/api/admin/export?type=bookings" className="btn-outline btn-sm">Export CSV</a>
      </AdminHeader>
      <Flash searchParams={searchParams} />
      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map(([k, l]) => (
          <Link key={k} href={`/admin/bookings?status=${k}`} className={`chip px-3.5 py-2 text-sm ${status === k ? "bg-navy-800 text-white" : "bg-white text-navy-900 ring-1 ring-line"}`}>
            {l}
          </Link>
        ))}
      </div>
      {rows.length === 0 ? (
        <p className="card p-6 text-sm text-muted">Nothing here.</p>
      ) : (
        <div className="space-y-3">
          {rows.map((b) => (
            <details key={b.id} className="card p-4" open={b.status === "needs_review"}>
              <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2">
                <span>
                  <b>{b.slots ? fmtDateTime(b.slots.start_at) : "—"}</b> · {b.service === "tuition" ? "Tuition" : "Doubt"} {b.slots && minutesLabel(b.slots.duration_minutes)} ·{" "}
                  {b.profiles?.full_name} <span className="text-muted">(Class {b.class_level} {b.board})</span>
                </span>
                <span className="flex gap-1.5">
                  <span className="chip bg-slate-100 text-slate-700">{inr(b.amount_paise)}</span>
                  <span className={`chip ${b.status === "confirmed" ? "bg-teal-50 text-teal-700" : b.status === "needs_review" ? "bg-amber-100 text-amber-900" : "bg-slate-100 text-slate-700"}`}>
                    {BOOKING_STATUS_LABEL[b.status] ?? b.status}
                  </span>
                </span>
              </summary>
              <div className="mt-4 grid gap-4 border-t border-line pt-4 text-sm lg:grid-cols-2">
                <dl className="grid grid-cols-[110px_1fr] gap-y-1">
                  <dt className="text-muted">Booking</dt><dd className="font-mono text-xs">{b.booking_number}</dd>
                  <dt className="text-muted">Order</dt><dd className="font-mono text-xs">{b.orders?.order_number ?? "—"} {b.orders && `(${b.orders.status})`}</dd>
                  <dt className="text-muted">Payment ID</dt><dd className="font-mono text-xs">{b.orders?.razorpay_payment_id ?? "—"}</dd>
                  <dt className="text-muted">Student</dt><dd>{b.profiles?.full_name}</dd>
                  <dt className="text-muted">Email</dt><dd><a className="underline" href={`mailto:${b.profiles?.email}`}>{b.profiles?.email}</a></dd>
                  <dt className="text-muted">Phone</dt><dd>{b.profiles?.phone ?? "—"}</dd>
                  <dt className="text-muted">Topic</dt><dd>{b.topic ?? "—"}</dd>
                  {b.admin_note && (<><dt className="text-muted">Note</dt><dd className="text-amber-800">{b.admin_note}</dd></>)}
                </dl>
                <div className="grid content-start gap-3">
                  {["confirmed", "needs_review"].includes(b.status) && (
                    <form action={updateBooking} className="flex gap-2">
                      <input type="hidden" name="id" value={b.id} />
                      <input type="hidden" name="action" value="link" />
                      <input type="hidden" name="return" value={ret} />
                      <input name="meeting_link" defaultValue={b.meeting_link ?? ""} placeholder="https://meet.google.com/…" className="input" />
                      <button className="btn-outline btn-sm">Save link</button>
                    </form>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {b.status === "needs_review" && (
                      <Action id={b.id} action="accept" ret={ret} label="Accept booking" cls="btn-primary btn-sm" confirm="Accept this booking? The slot may go over capacity." />
                    )}
                    {b.status === "confirmed" && <Action id={b.id} action="complete" ret={ret} label="Mark completed" />}
                    {["confirmed", "needs_review", "pending_payment"].includes(b.status) && (
                      <Action id={b.id} action="cancel" ret={ret} label="Cancel booking" cls="btn-ghost btn-sm text-red-700" confirm="Cancel this booking? (Refund separately below.)" />
                    )}
                  </div>
                  {b.order_id && ["paid", "needs_review", "partially_refunded"].includes(b.orders?.status ?? "") && (
                    <form action={refundOrder} className="flex flex-wrap items-center gap-2 rounded-xl bg-navy-50 p-3">
                      <input type="hidden" name="order_id" value={b.order_id} />
                      <input type="hidden" name="return" value={ret} />
                      <input name="amount" type="number" min={1} step="1" placeholder={`₹${b.amount_paise / 100} (full)`} className="input !w-32" />
                      <input name="reason" placeholder="Reason" className="input !w-40" />
                      <select name="mode" className="input !w-auto">
                        <option value="razorpay">Refund via Razorpay</option>
                        <option value="manual">I refunded manually (record only)</option>
                      </select>
                      <ConfirmButton message="Issue this refund?" className="btn-outline btn-sm">Refund</ConfirmButton>
                    </form>
                  )}
                </div>
              </div>
            </details>
          ))}
        </div>
      )}
    </>
  );
}

function Action({ id, action, ret, label, cls = "btn-outline btn-sm", confirm }: { id: string; action: string; ret: string; label: string; cls?: string; confirm?: string }) {
  return (
    <form action={updateBooking}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="action" value={action} />
      <input type="hidden" name="return" value={ret} />
      <ConfirmButton className={cls} message={confirm}>{label}</ConfirmButton>
    </form>
  );
}
