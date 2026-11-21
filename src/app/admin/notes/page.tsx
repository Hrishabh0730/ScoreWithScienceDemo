import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { inr } from "@/lib/format";
import { bulkPrice, quickNoteToggle } from "../actions";
import { AdminHeader, Field, Flash, Panel, type SP } from "../ui";

export default async function AdminNotes({ searchParams }: { searchParams: SP }) {
  const { supabase } = await requireAdmin();
  const [{ data: notes }, { data: files }, { data: sales }] = await Promise.all([
    supabase.from("notes").select("id, title, chapter_no, class_level, board, subject, price_paise, is_published, is_available").order("class_level").order("board").order("subject").order("chapter_no"),
    supabase.from("note_files").select("note_id"),
    supabase.from("order_items").select("note_id, orders!inner(status)").eq("orders.status", "paid"),
  ]);
  const hasFile = new Set((files ?? []).map((f) => f.note_id));
  const sold = new Map<string, number>();
  (sales ?? []).forEach((s) => sold.set(s.note_id, (sold.get(s.note_id) ?? 0) + 1));

  return (
    <>
      <AdminHeader title="Notes" lead="Upload PDFs, set prices, and choose what's visible and buyable.">
        <Link href="/admin/notes/new" className="btn-primary btn-sm">+ Add chapter</Link>
      </AdminHeader>
      <Flash searchParams={searchParams} />
      <div className="card mb-6 overflow-x-auto">
        <table className="table-x">
          <thead><tr><th>Chapter</th><th>Class</th><th>Price</th><th>PDF</th><th>Sold</th><th>Visible</th><th>For sale</th><th /></tr></thead>
          <tbody>
            {(notes ?? []).map((n) => (
              <tr key={n.id}>
                <td className="font-semibold">{n.chapter_no ? `${n.chapter_no}. ` : ""}{n.title}<span className="block text-xs text-muted">{n.subject}</span></td>
                <td>{n.class_level} {n.board}</td>
                <td>{inr(n.price_paise)}</td>
                <td>{hasFile.has(n.id) ? <span className="chip bg-teal-50 text-teal-700">Uploaded</span> : <span className="chip bg-amber-50 text-amber-800">Missing</span>}</td>
                <td>{sold.get(n.id) ?? 0}</td>
                <td><Toggle id={n.id} field="is_published" value={n.is_published} /></td>
                <td><Toggle id={n.id} field="is_available" value={n.is_available} /></td>
                <td><Link className="btn-outline btn-sm" href={`/admin/notes/${n.id}`}>Edit</Link></td>
              </tr>
            ))}
            {!notes?.length && <tr><td colSpan={8} className="text-muted">No chapters yet.</td></tr>}
          </tbody>
        </table>
      </div>
      <Panel title="Change prices in bulk">
        <form action={bulkPrice} className="grid gap-3 sm:grid-cols-4 sm:items-end">
          <Field label="New price (₹)"><input name="price" type="number" min={1} required defaultValue={10} className="input" /></Field>
          <Field label="Class"><select name="class_level" className="input"><option value="">All</option><option>8</option><option>9</option><option>10</option></select></Field>
          <Field label="Board"><select name="board" className="input"><option value="">All</option><option>CBSE</option><option>ICSE</option></select></Field>
          <button className="btn-outline">Apply</button>
        </form>
      </Panel>
    </>
  );
}

function Toggle({ id, field, value }: { id: string; field: string; value: boolean }) {
  return (
    <form action={quickNoteToggle}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="field" value={field} />
      <input type="hidden" name="value" value={String(!value)} />
      <button className={`chip ${value ? "bg-teal-600 text-white" : "bg-slate-200 text-slate-700"}`} aria-label={`${field} ${value ? "on" : "off"}, click to toggle`}>
        {value ? "On" : "Off"}
      </button>
    </form>
  );
}
