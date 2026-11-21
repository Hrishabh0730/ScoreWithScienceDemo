import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { getSettings } from "@/lib/data";
import { deleteNote } from "../../actions";
import { ConfirmButton } from "../../ConfirmButton";
import { NoteForm } from "../NoteForm";
import { AdminHeader, Flash, Panel, type SP } from "../../ui";

export default async function EditNote({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SP }) {
  const { id } = await params;
  const { supabase } = await requireAdmin();
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [{ data: note }, { data: file }, { pricing }] = await Promise.all([
    supabase.from("notes").select("*").eq("id", id).maybeSingle(),
    supabase.from("note_files").select("pdf_path, size_bytes").eq("note_id", id).maybeSingle(),
    getSettings(),
  ]);
  if (!note) notFound();
  return (
    <>
      <AdminHeader title={note.title}>
        <Link href={`/notes/${id}`} className="btn-ghost btn-sm" target="_blank">View in store ↗</Link>
        <Link href="/admin/notes" className="btn-ghost btn-sm">← All notes</Link>
      </AdminHeader>
      <Flash searchParams={searchParams} />
      <Panel title="Chapter details">
        <NoteForm note={{ ...note, pdf_path: file?.pdf_path, pdf_size: file?.size_bytes }} defaultPrice={pricing.note_default} />
      </Panel>
      <form action={deleteNote}>
        <input type="hidden" name="id" value={id} />
        <ConfirmButton className="btn-ghost btn-sm text-red-700" message="Delete this chapter and its PDF? This cannot be undone.">Delete chapter</ConfirmButton>
      </form>
    </>
  );
}
