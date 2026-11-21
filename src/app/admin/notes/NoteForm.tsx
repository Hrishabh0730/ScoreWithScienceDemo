"use client";
import Image from "next/image";
import { useState } from "react";
import { imageUrl } from "@/lib/images";
import { createClient } from "@/lib/supabase/browser";
import { saveNote } from "../actions";

interface NoteData {
  id?: string;
  title?: string;
  chapter_no?: number | null;
  class_level?: number;
  board?: string;
  subject?: string;
  description?: string;
  price_paise?: number;
  pages?: number | null;
  cover_path?: string | null;
  preview_paths?: string[];
  is_published?: boolean;
  is_available?: boolean;
  pdf_path?: string | null;
  pdf_size?: number | null;
}

const MAX_PDF = 50 * 1024 * 1024;
const MAX_IMG = 5 * 1024 * 1024;

export function NoteForm({ note, defaultPrice }: { note: NoteData; defaultPrice: number }) {
  const [cover, setCover] = useState(note.cover_path ?? "");
  const [previews, setPreviews] = useState<string[]>(note.preview_paths ?? []);
  const [pdf, setPdf] = useState({ path: note.pdf_path ?? "", size: note.pdf_size ?? 0, name: "" });
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function upload(bucket: "notes-pdf" | "note-images", folder: string, file: File) {
    const sb = createClient();
    const ext = (file.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
    const path = `${folder}/${crypto.randomUUID()}.${ext}`;
    const { error } = await sb.storage.from(bucket).upload(path, file, { contentType: file.type, upsert: false });
    if (error) throw new Error(error.message);
    return path;
  }

  async function onPdf(f: File | undefined) {
    if (!f) return;
    setError("");
    if (f.type !== "application/pdf") return setError("Please choose a PDF file.");
    if (f.size > MAX_PDF) return setError("PDF is larger than 50 MB. Compress it first (e.g. ilovepdf.com → Compress).");
    setBusy("Uploading PDF…");
    try {
      const path = await upload("notes-pdf", "notes", f);
      setPdf({ path, size: f.size, name: f.name });
    } catch (e) {
      setError(`Upload failed: ${(e as Error).message}`);
    } finally {
      setBusy(null);
    }
  }

  async function onImages(files: FileList | null, kind: "cover" | "preview") {
    if (!files?.length) return;
    setError("");
    setBusy("Uploading images…");
    try {
      for (const f of Array.from(files).slice(0, 8)) {
        if (!["image/jpeg", "image/png", "image/webp"].includes(f.type)) throw new Error(`${f.name}: use JPG, PNG or WebP`);
        if (f.size > MAX_IMG) throw new Error(`${f.name} is larger than 5 MB`);
        const p = await upload("note-images", kind === "cover" ? "covers" : "previews", f);
        if (kind === "cover") setCover(p);
        else setPreviews((x) => [...x, p].slice(0, 8));
      }
    } catch (e) {
      setError(`Upload failed: ${(e as Error).message}`);
    } finally {
      setBusy(null);
    }
  }

  return (
    <form action={saveNote} className="grid gap-5">
      {note.id && <input type="hidden" name="id" value={note.id} />}
      <input type="hidden" name="cover_path" value={cover} />
      <input type="hidden" name="preview_paths" value={previews.join("\n")} />
      <input type="hidden" name="pdf_path" value={pdf.path} />
      <input type="hidden" name="pdf_size" value={pdf.size || ""} />

      <div className="grid gap-4 sm:grid-cols-[1fr_120px]">
        <L label="Chapter title"><input name="title" required defaultValue={note.title} maxLength={150} className="input" /></L>
        <L label="Chapter no."><input name="chapter_no" type="number" min={0} max={99} defaultValue={note.chapter_no ?? ""} className="input" /></L>
      </div>
      <div className="grid gap-4 sm:grid-cols-4">
        <L label="Class">
          <select name="class_level" defaultValue={note.class_level ?? 10} className="input">{[8, 9, 10].map((c) => <option key={c} value={c}>Class {c}</option>)}</select>
        </L>
        <L label="Board">
          <select name="board" defaultValue={note.board ?? "CBSE"} className="input"><option>CBSE</option><option>ICSE</option></select>
        </L>
        <L label="Subject">
          <select name="subject" defaultValue={note.subject ?? "Chemistry"} className="input">{["Science", "Chemistry", "Physics", "Biology"].map((s) => <option key={s}>{s}</option>)}</select>
        </L>
        <L label="Price (₹)"><input name="price" type="number" min={1} max={100000} step="1" required defaultValue={note.price_paise ? note.price_paise / 100 : defaultPrice} className="input" /></L>
      </div>
      <L label="Description"><textarea name="description" rows={4} maxLength={2000} defaultValue={note.description} className="input" /></L>
      <L label="Number of pages (optional)"><input name="pages" type="number" min={1} defaultValue={note.pages ?? ""} className="input max-w-40" /></L>

      <div className="rounded-2xl border border-line p-4">
        <p className="label">Full notes PDF (private — only buyers can download)</p>
        <input type="file" accept="application/pdf" onChange={(e) => onPdf(e.target.files?.[0])} className="text-sm" disabled={!!busy} />
        <p className="mt-2 text-xs text-muted">
          {pdf.path ? `✅ ${pdf.name || "PDF uploaded"}${pdf.size ? ` (${(pdf.size / 1048576).toFixed(1)} MB)` : ""}` : "No PDF yet."} Max 50 MB. Files under 4 MB are watermarked with the buyer&apos;s email and order number on download.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-line p-4">
          <p className="label">Cover image (public)</p>
          <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => onImages(e.target.files, "cover")} className="text-sm" disabled={!!busy} />
          {cover && imageUrl(cover) && (
            <div className="mt-3 flex items-center gap-3">
              <Image src={imageUrl(cover)!} alt="" width={96} height={72} className="rounded-lg border border-line object-cover" unoptimized />
              <button type="button" className="btn-ghost btn-sm" onClick={() => setCover("")}>Remove</button>
            </div>
          )}
        </div>
        <div className="rounded-2xl border border-line p-4">
          <p className="label">Sample preview pages (public, up to 8)</p>
          <input type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={(e) => onImages(e.target.files, "preview")} className="text-sm" disabled={!!busy} />
          {previews.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {previews.map((p) => (
                <div key={p} className="relative">
                  {imageUrl(p) && <Image src={imageUrl(p)!} alt="" width={64} height={84} className="rounded border border-line object-cover" unoptimized />}
                  <button type="button" onClick={() => setPreviews((x) => x.filter((y) => y !== p))} className="absolute -right-2 -top-2 grid h-6 w-6 place-items-center rounded-full bg-red-600 text-xs text-white" aria-label="Remove preview">×</button>
                </div>
              ))}
            </div>
          )}
          <p className="mt-2 text-xs text-muted">Only upload pages you&apos;re happy for anyone to see.</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-6">
        <label className="inline-flex items-center gap-2 font-semibold"><input type="checkbox" name="is_published" defaultChecked={note.is_published ?? true} className="h-5 w-5 accent-navy-800" /> Show in store</label>
        <label className="inline-flex items-center gap-2 font-semibold"><input type="checkbox" name="is_available" defaultChecked={note.is_available ?? false} className="h-5 w-5 accent-navy-800" /> Available to buy (needs PDF)</label>
      </div>

      {busy && <p className="text-sm font-semibold text-navy-600" role="status">{busy}</p>}
      {error && <p className="text-sm font-semibold text-red-700" role="alert">{error}</p>}
      <button className="btn-primary justify-self-start" disabled={!!busy}>Save chapter</button>
    </form>
  );
}

function L({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
    </label>
  );
}
