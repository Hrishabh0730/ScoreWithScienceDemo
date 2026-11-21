import { requireAdmin } from "@/lib/auth";
import { fmtDate } from "@/lib/format";
import { AdminHeader, type SP } from "../ui";

export default async function Students({ searchParams }: { searchParams: SP }) {
  const { supabase } = await requireAdmin();
  const sp = await searchParams;
  const term = (sp.q || "").trim().slice(0, 80);
  let q = supabase
    .from("profiles")
    .select("id, full_name, email, phone, class_level, board, created_at, guardian_consent, orders(status), bookings(status)")
    .eq("role", "student")
    .order("created_at", { ascending: false })
    .limit(500);
  if (term) q = q.or(`full_name.ilike.%${term.replace(/[%,()]/g, "")}%,email.ilike.%${term.replace(/[%,()]/g, "")}%`);
  const { data } = await q;
  const rows = (data ?? []) as unknown as {
    id: string; full_name: string; email: string; phone: string | null; class_level: number | null; board: string | null; created_at: string; guardian_consent: boolean;
    orders: { status: string }[]; bookings: { status: string }[];
  }[];
  return (
    <>
      <AdminHeader title="Students" lead={`${rows.length} shown. Contact details are for class communication only.`}>
        <a href="/api/admin/export?type=students" className="btn-outline btn-sm">Export CSV</a>
      </AdminHeader>
      <form className="mb-4 flex gap-2">
        <input name="q" defaultValue={term} placeholder="Search name or email" className="input max-w-sm" />
        <button className="btn-outline">Search</button>
      </form>
      <div className="card overflow-x-auto">
        <table className="table-x">
          <thead><tr><th>Name</th><th>Contact</th><th>Class</th><th>Paid orders</th><th>Classes</th><th>Joined</th></tr></thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.id}>
                <td className="font-semibold">{s.full_name || "—"}{!s.guardian_consent && <span className="block text-xs text-amber-700">No guardian confirmation</span>}</td>
                <td>{s.email}<span className="block text-xs text-muted">{s.phone ?? ""}</span></td>
                <td>{s.class_level ? `${s.class_level} ${s.board ?? ""}` : "—"}</td>
                <td>{s.orders.filter((o) => o.status === "paid").length}</td>
                <td>{s.bookings.filter((b) => ["confirmed", "completed"].includes(b.status)).length}</td>
                <td>{fmtDate(s.created_at)}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={6} className="text-muted">No students yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
