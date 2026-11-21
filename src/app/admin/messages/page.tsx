import { requireAdmin } from "@/lib/auth";
import { fmtDateTime } from "@/lib/format";
import { markMessage } from "../actions";
import { ConfirmButton } from "../ConfirmButton";
import { AdminHeader, Flash, type SP } from "../ui";

export default async function Messages({ searchParams }: { searchParams: SP }) {
  const { supabase } = await requireAdmin();
  const { data } = await supabase.from("contact_messages").select("*").order("created_at", { ascending: false }).limit(200);
  return (
    <>
      <AdminHeader title="Messages" lead="From the contact form." />
      <Flash searchParams={searchParams} />
      <div className="space-y-3">
        {(data ?? []).map((m) => (
          <div key={m.id} className={`card p-5 ${m.is_read ? "opacity-70" : ""}`}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <p className="font-bold text-navy-900">
                {m.name} · <a className="font-normal underline" href={`mailto:${m.email}`}>{m.email}</a> {m.phone && <span className="font-normal text-muted">· {m.phone}</span>}
              </p>
              <span className="text-xs text-muted">{fmtDateTime(m.created_at)}</span>
            </div>
            <p className="mt-2 whitespace-pre-line text-sm">{m.message}</p>
            <div className="mt-3 flex gap-2">
              <form action={markMessage}>
                <input type="hidden" name="id" value={m.id} />
                <input type="hidden" name="read" value={String(!m.is_read)} />
                <button className="btn-outline btn-sm">{m.is_read ? "Mark unread" : "Mark read"}</button>
              </form>
              <form action={markMessage}>
                <input type="hidden" name="id" value={m.id} />
                <input type="hidden" name="delete" value="true" />
                <ConfirmButton className="btn-ghost btn-sm text-red-700" message="Delete this message?">Delete</ConfirmButton>
              </form>
            </div>
          </div>
        ))}
        {!data?.length && <p className="card p-6 text-sm text-muted">No messages yet.</p>}
      </div>
    </>
  );
}
