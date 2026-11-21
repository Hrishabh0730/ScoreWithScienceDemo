import type { Metadata } from "next";
import Link from "next/link";
import { logout } from "@/app/(auth)/actions";
import { Notice } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { fmtDateTime, inr, minutesLabel, nowMs } from "@/lib/format";
import { BOOKING_STATUS_LABEL, ORDER_STATUS_LABEL } from "@/lib/types";
import { ProfileForm } from "./ProfileForm";

export const metadata: Metadata = { title: "My account", robots: { index: false } };

interface BookingRow {
  id: string;
  booking_number: string;
  service: string;
  status: string;
  amount_paise: number;
  class_level: number;
  board: string;
  topic: string | null;
  meeting_link: string | null;
  created_at: string;
  slots: { start_at: string; end_at: string; duration_minutes: number } | null;
  orders: { order_number: string } | null;
}

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ pw?: string; denied?: string }> }) {
  const sp = await searchParams;
  const { supabase, user, profile } = await requireUser("/account");

  const [{ data: items }, { data: bookings }, { data: orders }] = await Promise.all([
    supabase
      .from("order_items")
      .select("note_id, title_snapshot, orders!inner(status, order_number, paid_at)")
      .eq("orders.status", "paid")
      .order("id"),
    supabase
      .from("bookings")
      .select("id, booking_number, service, status, amount_paise, class_level, board, topic, meeting_link, created_at, slots(start_at, end_at, duration_minutes), orders(order_number)")
      .not("status", "in", "(released,expired)")
      .order("created_at", { ascending: false })
      .limit(100),
    supabase.from("orders").select("order_number, kind, status, amount_paise, created_at, paid_at, last_error").order("created_at", { ascending: false }).limit(100),
  ]);

  const owned = new Map<string, { title: string; order: string }>();
  (items ?? []).forEach((i) => {
    const o = i.orders as unknown as { order_number: string };
    if (!owned.has(i.note_id)) owned.set(i.note_id, { title: i.title_snapshot, order: o.order_number });
  });
  const now = nowMs();
  const all = (bookings ?? []) as unknown as BookingRow[];
  const upcoming = all
    .filter((b) => ["confirmed", "needs_review"].includes(b.status) && b.slots && new Date(b.slots.end_at).getTime() > now)
    .sort((a, b) => +new Date(a.slots!.start_at) - +new Date(b.slots!.start_at));
  const history = all.filter((b) => !upcoming.includes(b));
  const visibleOrders = (orders ?? []).filter((o) => o.status !== "created" || o.last_error || +new Date(o.created_at) > now - 86400000);

  return (
    <div className="container-x py-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="eyebrow">My account</p>
          <h1 className="mt-1 text-3xl font-extrabold text-navy-900">Hi {profile?.full_name?.split(" ")[0] || "there"} 👋</h1>
          <p className="text-sm text-muted">{user.email}</p>
        </div>
        <div className="flex gap-2">
          {profile?.role === "admin" && <Link href="/admin" className="btn-outline">Admin dashboard</Link>}
          <form action={logout}>
            <button className="btn-ghost">Log out</button>
          </form>
        </div>
      </div>
      <div className="mt-4 space-y-2">
        {sp.pw && <Notice tone="success">Your password has been updated.</Notice>}
        {sp.denied && <Notice tone="warn">That page is for the site administrator only.</Notice>}
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-8">
          <Section title="Upcoming classes" id="upcoming">
            {upcoming.length === 0 ? (
              <Empty text="No upcoming classes." cta={{ href: "/book", label: "Book a class" }} />
            ) : (
              <ul className="divide-y divide-line">
                {upcoming.map((b) => (
                  <li key={b.id} className="flex flex-wrap items-start justify-between gap-3 p-4">
                    <div>
                      <p className="font-bold text-navy-900">
                        {b.service === "tuition" ? "Chemistry tuition" : "Doubt session"} · {minutesLabel(b.slots!.duration_minutes)}
                      </p>
                      <p className="text-sm text-ink">{fmtDateTime(b.slots!.start_at)} IST</p>
                      <p className="text-xs text-muted">
                        {b.booking_number} · Class {b.class_level} {b.board}
                      </p>
                    </div>
                    <div className="text-right">
                      <StatusChip status={b.status} />
                      {b.status === "confirmed" &&
                        (b.meeting_link ? (
                          <a href={b.meeting_link} target="_blank" rel="noopener noreferrer" className="btn-accent btn-sm mt-2 flex">
                            Join class
                          </a>
                        ) : (
                          <p className="mt-2 text-xs text-muted">Class link will appear here before the session.</p>
                        ))}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="My notes" id="notes">
            {owned.size === 0 ? (
              <Empty text="You haven't bought any notes yet." cta={{ href: "/notes", label: "Browse notes" }} />
            ) : (
              <ul className="divide-y divide-line">
                {[...owned.entries()].map(([id, n]) => (
                  <li key={id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                    <div>
                      <p className="font-bold text-navy-900">{n.title}</p>
                      <p className="text-xs text-muted">Order {n.order}</p>
                    </div>
                    <a href={`/api/download/${id}`} className="btn-primary btn-sm">Download PDF</a>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Booking history" id="history">
            {history.length === 0 ? (
              <Empty text="No past bookings." />
            ) : (
              <div className="overflow-x-auto">
                <table className="table-x">
                  <thead>
                    <tr><th>Booking</th><th>When</th><th>Amount</th><th>Status</th></tr>
                  </thead>
                  <tbody>
                    {history.map((b) => (
                      <tr key={b.id}>
                        <td>
                          <span className="font-semibold">{b.service === "tuition" ? "Tuition" : "Doubt"}</span>
                          <span className="block text-xs text-muted">{b.booking_number}</span>
                        </td>
                        <td>{b.slots ? fmtDateTime(b.slots.start_at) : "—"}</td>
                        <td>{inr(b.amount_paise)}</td>
                        <td><StatusChip status={b.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>

          <Section title="Payments & receipts" id="payments">
            {visibleOrders.length === 0 ? (
              <Empty text="No payments yet." />
            ) : (
              <div className="overflow-x-auto">
                <table className="table-x">
                  <thead>
                    <tr><th>Order</th><th>Date</th><th>Amount</th><th>Status</th><th /></tr>
                  </thead>
                  <tbody>
                    {visibleOrders.map((o) => (
                      <tr key={o.order_number}>
                        <td>
                          <span className="font-semibold">{o.order_number}</span>
                          <span className="block text-xs text-muted">{o.kind === "notes" ? "Notes" : "Class booking"}</span>
                        </td>
                        <td>{fmtDateTime(o.created_at)}</td>
                        <td>{inr(o.amount_paise)}</td>
                        <td>{ORDER_STATUS_LABEL[o.status] ?? o.status}</td>
                        <td>{o.status !== "created" && <Link className="text-navy-600 underline" href={`/account/receipt/${o.order_number}`}>Receipt</Link>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>
        </div>

        <aside>
          <Section title="Profile" id="profile">
            <div className="p-5">
              <ProfileForm
                profile={{ full_name: profile?.full_name ?? "", phone: profile?.phone ?? "", class_level: profile?.class_level ?? null, board: profile?.board ?? null }}
              />
              <p className="mt-4 text-xs text-muted">
                Need your data deleted or exported? <Link href="/contact" className="underline">Contact us</Link>. See our{" "}
                <Link href="/policies/privacy" className="underline">privacy policy</Link>.
              </p>
            </div>
          </Section>
        </aside>
      </div>
    </div>
  );
}

function Section({ title, id, children }: { title: string; id: string; children: React.ReactNode }) {
  return (
    <section id={id} className="card overflow-hidden" aria-labelledby={`${id}-h`}>
      <h2 id={`${id}-h`} className="border-b border-line px-5 py-4 text-lg font-bold text-navy-900">{title}</h2>
      {children}
    </section>
  );
}

function Empty({ text, cta }: { text: string; cta?: { href: string; label: string } }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 p-5 text-sm text-muted">
      {text}
      {cta && <Link href={cta.href} className="btn-outline btn-sm">{cta.label}</Link>}
    </div>
  );
}

function StatusChip({ status }: { status: string }) {
  const tone =
    status === "confirmed" || status === "completed"
      ? "bg-teal-50 text-teal-700"
      : status === "needs_review" || status === "pending_payment"
        ? "bg-amber-50 text-amber-800"
        : "bg-slate-100 text-slate-600";
  return <span className={`chip ${tone}`}>{BOOKING_STATUS_LABEL[status] ?? status}</span>;
}
