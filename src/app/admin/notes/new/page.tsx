import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { getSettings } from "@/lib/data";
import { NoteForm } from "../NoteForm";
import { AdminHeader, Flash, Panel, type SP } from "../../ui";

export default async function NewNote({ searchParams }: { searchParams: SP }) {
  await requireAdmin();
  const { pricing } = await getSettings();
  return (
    <>
      <AdminHeader title="Add a chapter"><Link href="/admin/notes" className="btn-ghost btn-sm">← All notes</Link></AdminHeader>
      <Flash searchParams={searchParams} />
      <Panel title="Chapter details">
        <NoteForm note={{}} defaultPrice={pricing.note_default} />
      </Panel>
    </>
  );
}
