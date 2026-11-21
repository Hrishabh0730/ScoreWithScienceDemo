import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { fmtDateTime, inr } from "@/lib/format";
import { ORDER_STATUS_LABEL } from "@/lib/types";
import { refundOrder } from "../actions";
import { ConfirmButton } from "../ConfirmButton";
import { AdminHeader, Flash, type SP } from "../ui";

export default async function Orders({ searchParams }: { searchParams: SP }) {
  const { supabase } = await requireAdmin();
  const sp = await searchParams;
  const kind = sp.kind === "notes" || sp.kind === "booking" ? sp.kind : null;
  const showAll = sp.all === "1";
  let q = supabase
    .from("orders")
    .select("id, order_number, kind, status, amount_paise, created_at, paid_at, razorpay_payment_id, payment_method, last_error, profiles(full_name, email), order_items(title_snapshot), refunds(amount_paise, status)")
    .order("created_at", { ascending: false })
    .limit(300);
  if (kind) q = q.eq("kind", kind);
  if (!showAll) q = q.neq("status", "created").neq("status", "cancelled");
  const { data } = await q;
  const rows = (data ?? []) as unknown as {
    id: string; order_number: string; kind: string; status: string; amount_paise: number; created_at: string; paid_at: string | null;
    razorpay_payment_id: string | null; payment_method: string | null; last_error: string | null;
    profiles: { full_name: string; email: string } | null; order_items: { title_snapshot: string }[]; refunds: { amount_paise: number; status: string }[];
  }[];
  const ret = `/admin/orders?${new URLSearchParams({ ...(kind ? { kind } : {}), ...(showAll ? { all: "1" } : {}) })}`;
  const link = (k: string | null, a: boolean) => `/admin/orders?${new URLSearchParams({ ...(k ? { kind: k } : {}), ...(a ? { all: "1" } : {}) })}`;

  return (
    <>
      <AdminHeader title="Payments" lead="Every verified payment. Amounts are checked with Razorpay on the server.">
        <a href="/api/admin/export?type=orders" className="btn-outline btn-sm">Export CSV</a>
      </AdminHeader>
      <Flash searchParams={searchParams} />
      <div className="mb-4 flex flex-wrap gap-2">
        {[[null, "All"], ["notes", "Notes"], ["booking", "Classes"]].map(([k, l]) => (
          <Link key={String(k)} href={link(k, showAll)} className={`chip px-3.5 py-2 text-sm ${kind === k ? "bg-navy-800 text-white" : "bg-white ring-1 ring-line"}`}>{l}</Link>
        ))}
        <Link href={link(kind, !showAll)} className="chip bg-white px-3.5 py-2 text-sm ring-1 ring-line">{showAll ? "Hide unpaid attempts" : "Show unpaid attempts"}</Link>
      </div>
      <div className="card overflow-x-auto">
        <table className="table-x">
          <thead><tr><th>Order</th><th>Student</th><th>Items</th><th>Amount</th><th>Status</th><th>Refund</th></tr></thead>
          <tbody>
            {rows.map((o) => {
              const refunded = o.refunds.filter((r) => r.status !== "failed").reduce((s, r) => s + r.amount_paise, 0);
              return (
                <tr key={o.id}>
                  <td>
                    <span className="font-mono text-xs font-semibold">{o.order_number}</span>
                    <span className="block text-xs text-muted">{fmtDateTime(o.paid_at ?? o.created_at)}</span>
                    <span className="block font-mono text-[11px] text-muted">{o.razorpay_payment_id}</span>
                  </td>
                  <td>{o.profiles?.full_name}<span className="block text-xs text-muted">{o.profiles?.email}</span></td>
                  <td className="max-w-xs text-xs">{o.kind === "notes" ? o.order_items.map((i) => i.title_snapshot).join(", ") : "Class booking"}</td>
                  <td className="font-semibold">{inr(o.amount_paise)}{refunded > 0 && <span className="block text-xs text-red-700">−{inr(refunded)}</span>}</td>
                  <td>{ORDER_STATUS_LABEL[o.status] ?? o.status}{o.last_error && <span className="block text-xs text-red-700">{o.last_error}</span>}</td>
                  <td>
                    {o.kind === "notes" && ["paid", "needs_review", "partially_refunded"].includes(o.status) && (
                      <form action={refundOrder} className="flex flex-col gap-1">
                        <input type="hidden" name="order_id" value={o.id} />
                        <input type="hidden" name="return" value={ret} />
                        <input name="amount" type="number" min={1} placeholder="₹ (full)" className="input !min-h-8 !w-24 !py-1 text-xs" />
                        <select name="mode" className="input !min-h-8 !py-1 text-xs"><option value="razorpay">Via Razorpay</option><option value="manual">Record only</option></select>
                        <ConfirmButton message="Refund this order?">Refund</ConfirmButton>
                      </form>
                    )}
                    {o.kind === "booking" && <Link className="text-xs underline" href="/admin/bookings?status=all">Manage in bookings</Link>}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && <tr><td colSpan={6} className="text-muted">No payments yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
