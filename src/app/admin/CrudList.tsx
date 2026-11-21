import { deleteRow, saveRow } from "./actions";
import { ConfirmButton } from "./ConfirmButton";

export interface Col {
  name: string;
  label: string;
  type?: "text" | "textarea" | "number" | "select";
  options?: [string, string][];
  required?: boolean;
  placeholder?: string;
  wide?: boolean;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export function CrudList({ table, cols, rows, itemTitle }: { table: string; cols: Col[]; rows: any[]; itemTitle: (r: any) => string }) {
  return (
    <div className="space-y-4">
      <details className="card p-5" open={rows.length === 0}>
        <summary className="cursor-pointer font-bold text-navy-900">+ Add new</summary>
        <RowForm table={table} cols={cols} row={{ is_published: true, sort_order: 0 }} />
      </details>
      {rows.map((r) => (
        <details key={r.id} className="card p-5">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
            <span className="font-semibold text-navy-900">{itemTitle(r)}</span>
            <span className={`chip ${r.is_published ? "bg-teal-50 text-teal-700" : "bg-slate-100 text-slate-600"}`}>{r.is_published ? "Published" : "Hidden"}</span>
          </summary>
          <RowForm table={table} cols={cols} row={r} />
          <form action={deleteRow} className="mt-2">
            <input type="hidden" name="table" value={table} />
            <input type="hidden" name="id" value={r.id} />
            <ConfirmButton className="btn-ghost btn-sm text-red-700" message="Delete this item?">Delete</ConfirmButton>
          </form>
        </details>
      ))}
    </div>
  );
}

function RowForm({ table, cols, row }: { table: string; cols: Col[]; row: any }) {
  return (
    <form action={saveRow} className="mt-4 grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="table" value={table} />
      {row.id && <input type="hidden" name="id" value={row.id} />}
      {cols.map((c) => (
        <label key={c.name} className={`block ${c.wide || c.type === "textarea" ? "sm:col-span-2" : ""}`}>
          <span className="label">{c.label}</span>
          {c.type === "textarea" ? (
            <textarea name={c.name} defaultValue={row[c.name] ?? ""} required={c.required} rows={3} className="input" />
          ) : c.type === "select" ? (
            <select name={c.name} defaultValue={row[c.name] ?? ""} className="input">
              {c.options!.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          ) : (
            <input name={c.name} type={c.type ?? "text"} defaultValue={row[c.name] ?? ""} required={c.required} placeholder={c.placeholder} className="input" />
          )}
        </label>
      ))}
      <label className="block">
        <span className="label">Order (lower first)</span>
        <input name="sort_order" type="number" defaultValue={row.sort_order ?? 0} className="input" />
      </label>
      <label className="inline-flex items-center gap-2 self-end pb-3 font-semibold">
        <input type="checkbox" name="is_published" defaultChecked={row.is_published} className="h-5 w-5 accent-navy-800" /> Published
      </label>
      <button className="btn-primary btn-sm justify-self-start">Save</button>
    </form>
  );
}
