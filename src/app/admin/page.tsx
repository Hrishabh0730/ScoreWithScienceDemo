import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { getSettings } from "@/lib/data";
import { fmtDateTime, inr, minutesLabel } from "@/lib/format";
import { AdminHeader, Panel } from "./ui";

interface Stats {
  notes_revenue_paise: number;
  booking_revenue_paise: number;
  refunded_paise: number;
  notes_sold: number;
  students: number;
  upcoming_bookings: number;
  needs_review: number;
  pending_payments: number;
  open_slots: number;
}

export default async function AdminHome() {
  const { supabase } = await requireAdmin();
  const [{ data: stats }, { booking }, { data: upcoming }, { data: review }] = await Promise.all([
    supabase.rpc("admin_stats"),
    getSettings(),
    supabase
      .from("bookings")
      .select("id, booking_number, service, class_level, board, meeting_link, profiles(full_name), slots!inner(start_at, duration_minutes)")
      .eq("status", "confirmed")
      .gt("slots.start_at", new Date().toISOString())
      .order("start_at", { referencedTable: "slots" })
      .limit(8),
    supabase.from("bookings").select("id, booking_number, admin_note, amount_paise, profiles(full_name)").eq("status", "needs_review").limit(10),
  ]);
  const s = (stats ?? {}) as Stats;
  const rows = ((upcoming ?? []) as unknown as {
    id: string; booking_number: string; service: string; class_level: number; board: string; meeting_link: string | null;
    profiles: { full_name: string } | null; slots: { start_at: string; duration_minutes: number };
  }[]).sort((a, b) => +new Date(a.slots.start_at) - +new Date(b.slots.start_at));

  return (
    <>
      <AdminHeader title="Overview" lead="Your teaching business at a glance.">
        <Link href="/admin/availability" className="btn-primary btn-sm">Open new slots</Link>
        <Link href="/admin/notes/new" className="btn-outline btn-sm">Upload notes</Link>
      </AdminHeader>

      <div className={`mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl px-5 py-4 ${booking.bookings_open ? "bg-teal-50 text-teal-700" : "bg-red-50 text-red-800"}`}>
        <p className="font-bold">{booking.bookings_open ? `Bookings are OPEN · ${s.open_slots ?? 0} upcoming open slot(s)` : "Bookings are CLOSED — nobody can book or pay for a class."}</p>
        <Link href="/admin/availability" className="btn-outline btn-sm">Manage</Link>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Tile k="Total revenue" v={inr((s.notes_revenue_paise ?? 0) + (s.booking_revenue_paise ?? 0))} sub={s.refunded_paise ? `${inr(s.refunded_paise)} refunded` : undefined} />
        <Tile k="Notes revenue" v={inr(s.notes_revenue_paise ?? 0)} sub={`${s.notes_sold ?? 0} chapters sold`} />
        <Tile k="Class revenue" v={inr(s.booking_revenue_paise ?? 0)} />
        <Tile k="Students" v={String(s.students ?? 0)} />
        <Tile k="Upcoming classes" v={String(s.upcoming_bookings ?? 0)} href="/admin/bookings" />
        <Tile k="Payments in progress" v={String(s.pending_payments ?? 0)} href="/admin/bookings?status=pending_payment" />
        <Tile k="Need your review" v={String(s.needs_review ?? 0)} href="/admin/bookings?status=needs_review" alert={(s.needs_review ?? 0) > 0} />
        <Tile k="Open slots" v={String(s.open_slots ?? 0)} href="/admin/availability" />
      </div>

      {(review?.length ?? 0) > 0 && (
        <Panel title="⚠️ Paid bookings that need your decision">
          <p className="mb-3 text-sm text-muted">These students paid, but the slot was closed, full or blocked by the time payment finished. Accept them or cancel and refund.</p>
          <ul className="divide-y divide-line text-sm">
            {(review as unknown as { id: string; booking_number: string; admin_note: string | null; amount_paise: number; profiles: { full_name: string } | null }[]).map((r) => (
              <li key={r.id} className="flex flex-wrap justify-between gap-2 py-2">
                <span><b>{r.booking_number}</b> · {r.profiles?.full_name} · {inr(r.amount_paise)}<span className="block text-xs text-muted">{r.admin_note}</span></span>
                <Link className="btn-outline btn-sm" href={`/admin/bookings?status=needs_review`}>Review</Link>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <div className="mt-6">
        <Panel title="Next classes" actions={<Link href="/admin/bookings" className="text-sm font-semibold text-navy-600">All bookings →</Link>}>
          {rows.length === 0 ? (
            <p className="text-sm text-muted">No upcoming confirmed classes.</p>
          ) : (
            <ul className="divide-y divide-line text-sm">
              {rows.map((b) => (
                <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                  <span>
                    <b>{fmtDateTime(b.slots.start_at)}</b> · {b.service === "tuition" ? "Tuition" : "Doubt"} {minutesLabel(b.slots.duration_minutes)} · {b.profiles?.full_name} (Class {b.class_level} {b.board})
                  </span>
                  {!b.meeting_link && <span className="chip bg-amber-50 text-amber-800">Add class link</span>}
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}

function Tile({ k, v, sub, href, alert }: { k: string; v: string; sub?: string; href?: string; alert?: boolean }) {
  const body = (
    <div className={`card h-full p-4 ${alert ? "border-amber-300 bg-amber-50" : ""}`}>
      <p className="text-xs font-bold uppercase tracking-wide text-muted">{k}</p>
      <p className="mt-1 text-2xl font-extrabold text-navy-900">{v}</p>
      {sub && <p className="text-xs text-muted">{sub}</p>}
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}
