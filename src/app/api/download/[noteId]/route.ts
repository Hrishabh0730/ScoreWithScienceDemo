import type { NextRequest } from "next/server";
import { fail } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";
import { watermarkPdf } from "@/lib/watermark";

export const runtime = "nodejs";
export const maxDuration = 30;

// Serverless responses are size-limited (≈4.5 MB on Vercel). Bigger files are
// served through a 60-second signed link instead of being watermarked in-line.
const INLINE_LIMIT = 4 * 1024 * 1024;

export async function GET(_req: NextRequest, { params }: { params: Promise<{ noteId: string }> }) {
  const { noteId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(noteId)) return fail("Not found", 404);

  const { user } = await getSession();
  if (!user) return fail("Please log in to download.", 401);

  const db = createServiceClient();
  // Ownership check on the server: a PAID order containing this note.
  const { data: owns } = await db.rpc("user_owns_note", { p_user: user.id, p_note: noteId });
  if (!owns) return fail("You haven't purchased these notes.", 403);

  const { data: file } = await db.from("note_files").select("pdf_path, size_bytes, notes(title)").eq("note_id", noteId).maybeSingle();
  if (!file) return fail("File not uploaded yet. Please contact us.", 404);

  const { data: item } = await db
    .from("order_items")
    .select("orders!inner(order_number, user_id, status, paid_at)")
    .eq("note_id", noteId)
    .eq("orders.user_id", user.id)
    .eq("orders.status", "paid")
    .order("id")
    .limit(1)
    .maybeSingle();
  const orderNumber = (item?.orders as unknown as { order_number: string } | undefined)?.order_number ?? "";
  const title = ((file.notes as unknown as { title: string } | null)?.title ?? "notes").replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-");
  const filename = `ScoreWithScience-${title}.pdf`;

  if (file.size_bytes && file.size_bytes > INLINE_LIMIT) {
    const { data: signed } = await db.storage.from("notes-pdf").createSignedUrl(file.pdf_path, 60, { download: filename });
    if (!signed) return fail("Could not prepare download.", 500);
    return Response.redirect(signed.signedUrl, 302);
  }

  const { data: blob, error } = await db.storage.from("notes-pdf").download(file.pdf_path);
  if (error || !blob) return fail("Could not read file.", 500);
  let bytes: Uint8Array = new Uint8Array(await blob.arrayBuffer());
  try {
    bytes = await watermarkPdf(bytes, `Licensed to ${user.email} | Order ${orderNumber} | ScoreWithScience - personal use only`);
  } catch (e) {
    console.error("watermark failed; serving original", e);
  }
  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
