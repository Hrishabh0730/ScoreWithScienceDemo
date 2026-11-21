import type { Metadata } from "next";
import Link from "next/link";
import { NoteCard, PageHero } from "@/components/ui";
import { getPublishedNotes, getSettings } from "@/lib/data";
import { inr } from "@/lib/format";
import { BOARDS, CLASSES, SUBJECTS } from "@/lib/types";

export const metadata: Metadata = {
  title: "Handwritten Science & Chemistry Notes",
  description: "Chapter-wise handwritten notes for Class 8, 9 and 10, CBSE and ICSE. Instant download after payment.",
  alternates: { canonical: "/notes" },
};

type SP = Promise<{ q?: string; class?: string; board?: string; subject?: string }>;

export default async function NotesStore({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const [{ pricing }, all] = await Promise.all([getSettings(), getPublishedNotes()]);
  const q = (sp.q || "").trim().toLowerCase().slice(0, 80);
  const cls = Number(sp.class) || null;
  const board = BOARDS.includes(sp.board as never) ? sp.board : null;
  const subject = SUBJECTS.includes(sp.subject as never) ? sp.subject : null;

  const notes = all.filter(
    (n) =>
      (!cls || n.class_level === cls) &&
      (!board || n.board === board) &&
      (!subject || n.subject === subject) &&
      (!q || `${n.title} ${n.description} ${n.subject} class ${n.class_level} ${n.board}`.toLowerCase().includes(q)),
  );
  const filtered = Boolean(q || cls || board || subject);

  return (
    <>
      <PageHero
        eyebrow="Notes store"
        title="Handwritten notes, chapter by chapter"
        lead={`Clear, neatly handwritten notes for Classes 8–10 (CBSE & ICSE). ${inr(pricing.note_default * 100)} per chapter — add several to your cart and pay once.`}
      />
      <div className="container-x py-10">
        <form method="get" className="card grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_auto]" role="search">
          <div>
            <label htmlFor="q" className="sr-only">Search notes</label>
            <input id="q" name="q" defaultValue={sp.q} placeholder="Search chapters, e.g. “acids”" className="input" />
          </div>
          <Select name="class" label="Class" value={cls ? String(cls) : ""} options={CLASSES.map((c) => [String(c), `Class ${c}`])} />
          <Select name="board" label="Board" value={board || ""} options={BOARDS.map((b) => [b, b])} />
          <Select name="subject" label="Subject" value={subject || ""} options={SUBJECTS.map((s) => [s, s])} />
          <div className="flex gap-2">
            <button className="btn-primary flex-1">Filter</button>
            {filtered && (
              <Link href="/notes" className="btn-ghost">Clear</Link>
            )}
          </div>
        </form>

        <p className="mt-6 text-sm font-semibold text-muted" aria-live="polite">
          {notes.length} {notes.length === 1 ? "chapter" : "chapters"} {filtered ? "match your filters" : "in the store"}
        </p>

        {notes.length > 0 ? (
          <div className="mt-4 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {notes.map((n) => (
              <NoteCard key={n.id} note={n} />
            ))}
          </div>
        ) : (
          <div className="card mt-4 p-10 text-center">
            <p className="font-bold text-navy-900">No notes found.</p>
            <p className="mt-1 text-sm text-muted">Try a different search, or ask us which chapter you need via the contact page.</p>
          </div>
        )}
      </div>
    </>
  );
}

function Select({ name, label, value, options }: { name: string; label: string; value: string; options: [string, string][] }) {
  return (
    <div>
      <label htmlFor={`f-${name}`} className="sr-only">{label}</label>
      <select id={`f-${name}`} name={name} defaultValue={value} className="input">
        <option value="">All {label === "Class" ? "classes" : label.toLowerCase() + "s"}</option>
        {options.map(([v, l]) => (
          <option key={v} value={v}>{l}</option>
        ))}
      </select>
    </div>
  );
}
