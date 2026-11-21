"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertAdmin } from "@/lib/auth";
import { cleanText, istToIso } from "@/lib/format";
import { POLICY_SLUGS } from "@/lib/policies";
import { razorpay } from "@/lib/razorpay";
import { createServiceClient } from "@/lib/supabase/server";

function back(path: string, msg: string, tone: "ok" | "err" = "ok"): never {
  const [base, hash] = path.split("#");
  redirect(`${base}${base.includes("?") ? "&" : "?"}${tone}=${encodeURIComponent(msg)}${hash ? `#${hash}` : ""}`);
}
const bool = (fd: FormData, k: string) => fd.get(k) === "on" || fd.get(k) === "true";
const uuid = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(s)) throw new Error("Bad id");
  return s;
};
const revalidatePublic = () => revalidatePath("/", "layout");

function dbError(msg: string) {
  if (msg.includes("slots_no_overlap")) return "That time overlaps an existing slot.";
  if (msg.includes("slot_has_bookings")) return "This slot has paid bookings — cancel them first, or just close the slot.";
  return msg;
}

// ───────────────────────── Availability ─────────────────────────

export async function createSlots(fd: FormData) {
  const { supabase } = await assertAdmin();
  const P = "/admin/availability";
  const from = String(fd.get("date_from") || "");
  const to = String(fd.get("date_to") || from);
  const start = String(fd.get("start_time") || "");
  const end = String(fd.get("end_time") || "");
  const len = Number(fd.get("slot_minutes"));
  const capacity = Math.max(1, Math.min(50, Number(fd.get("capacity")) || 1));
  const allow_tuition = bool(fd, "allow_tuition");
  const allow_doubt = bool(fd, "allow_doubt");
  const weekdays = fd.getAll("weekday").map(Number);
  if (!allow_tuition && !allow_doubt) back(P, "Tick tuition, doubt sessions, or both.", "err");
  if (![30, 60, 90, 120].includes(len)) back(P, "Choose a slot length.", "err");
  let s: string, e: string, d0: Date, d1: Date;
  try {
    s = istToIso(from, start);
    e = istToIso(from, end);
    d0 = new Date(`${from}T00:00:00+05:30`);
    d1 = new Date(`${to}T00:00:00+05:30`);
  } catch {
    back(P, "Enter valid dates and times.", "err");
  }
  if (new Date(e) <= new Date(s)) back(P, "End time must be after start time.", "err");
  if (d1 < d0 || (d1.getTime() - d0.getTime()) / 86400000 > 92) back(P, "Date range must be 0–92 days.", "err");

  const rows: Record<string, unknown>[] = [];
  for (let d = new Date(d0); d <= d1; d = new Date(d.getTime() + 86400000)) {
    const dayKey = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(d);
    const wd = new Date(`${dayKey}T12:00:00+05:30`).getUTCDay();
    if (weekdays.length && !weekdays.includes(wd)) continue;
    let t = new Date(istToIso(dayKey, start));
    const stop = new Date(istToIso(dayKey, end));
    while (t.getTime() + len * 60000 <= stop.getTime()) {
      const tEnd = new Date(t.getTime() + len * 60000);
      if (t > new Date()) rows.push({ start_at: t.toISOString(), end_at: tEnd.toISOString(), capacity, allow_tuition, allow_doubt, note: cleanText(fd.get("note"), 200) || null });
      t = tEnd;
    }
  }
  if (!rows.length) back(P, "No future slots fit those settings.", "err");
  if (rows.length > 500) back(P, "That would create more than 500 slots — use a shorter range.", "err");

  let created = 0;
  const skipped: string[] = [];
  for (const r of rows) {
    const { error } = await supabase.from("slots").insert(r);
    if (error) skipped.push(dbError(error.message));
    else created++;
  }
  revalidatePath(P);
  back(P, `${created} slot(s) opened${skipped.length ? `, ${skipped.length} skipped (overlap with existing slots)` : ""}.`, created ? "ok" : "err");
}

export async function setSlotOpen(fd: FormData) {
  const { supabase } = await assertAdmin();
  const id = uuid(fd.get("id"));
  const open = fd.get("open") === "true";
  const { error } = open ? await supabase.from("slots").update({ is_open: true }).eq("id", id) : await supabase.rpc("admin_close_slot", { p_slot: id });
  if (error) back("/admin/availability", dbError(error.message), "err");
  revalidatePath("/admin/availability");
  back("/admin/availability", open ? "Slot reopened." : "Slot closed. No new payments can start for it.");
}

export async function updateSlot(fd: FormData) {
  const { supabase } = await assertAdmin();
  const id = uuid(fd.get("id"));
  const allow_tuition = bool(fd, "allow_tuition");
  const allow_doubt = bool(fd, "allow_doubt");
  if (!allow_tuition && !allow_doubt) back("/admin/availability", "A slot must allow at least one session type.", "err");
  const { error } = await supabase
    .from("slots")
    .update({ allow_tuition, allow_doubt, capacity: Math.max(1, Math.min(50, Number(fd.get("capacity")) || 1)), note: cleanText(fd.get("note"), 200) || null })
    .eq("id", id);
  if (error) back("/admin/availability", dbError(error.message), "err");
  back("/admin/availability", "Slot updated.");
}

export async function removeSlot(fd: FormData) {
  const { supabase } = await assertAdmin();
  const { data, error } = await supabase.rpc("admin_remove_slot", { p_slot: uuid(fd.get("id")) });
  if (error) back("/admin/availability", dbError(error.message), "err");
  back("/admin/availability", data === "deleted" ? "Slot removed." : "Slot removed (kept in history because it had past holds).");
}

export async function closeDaySlots(fd: FormData) {
  const { supabase } = await assertAdmin();
  const day = String(fd.get("day") || "");
  const { data: slots } = await supabase
    .from("slots")
    .select("id")
    .eq("archived", false)
    .eq("is_open", true)
    .gte("start_at", istToIso(day, "00:00"))
    .lt("start_at", new Date(new Date(istToIso(day, "00:00")).getTime() + 86400000).toISOString());
  for (const s of slots ?? []) await supabase.rpc("admin_close_slot", { p_slot: s.id });
  back("/admin/availability", `Closed ${slots?.length ?? 0} slot(s) on ${day}.`);
}

export async function addBlock(fd: FormData) {
  const { supabase } = await assertAdmin();
  const day = String(fd.get("day") || "");
  const dayTo = String(fd.get("day_to") || day);
  const whole = bool(fd, "whole_day");
  let start: string, end: string;
  try {
    start = istToIso(day, whole ? "00:00" : String(fd.get("from")));
    end = whole ? new Date(new Date(istToIso(dayTo, "00:00")).getTime() + 86400000).toISOString() : istToIso(dayTo, String(fd.get("to")));
  } catch {
    back("/admin/availability", "Enter a valid date (and times).", "err");
  }
  if (new Date(end) <= new Date(start)) back("/admin/availability", "Block end must be after start.", "err");
  const { error } = await supabase.from("blocked_periods").insert({ start_at: start, end_at: end, reason: cleanText(fd.get("reason"), 200) || null });
  if (error) back("/admin/availability", error.message, "err");
  // Cancel live holds in the blocked window right away.
  const { data: affected } = await supabase.from("slots").select("id").lt("start_at", end).gt("end_at", start);
  const ids = (affected ?? []).map((s) => s.id);
  if (ids.length) {
    await supabase
      .from("bookings")
      .update({ status: "cancelled", cancelled_at: new Date().toISOString(), admin_note: "Hold cancelled: time blocked by teacher" })
      .in("slot_id", ids)
      .eq("status", "pending_payment");
  }
  back("/admin/availability", "Time blocked. Slots in that period can't be booked.");
}

export async function removeBlock(fd: FormData) {
  const { supabase } = await assertAdmin();
  await supabase.from("blocked_periods").delete().eq("id", uuid(fd.get("id")));
  back("/admin/availability", "Block removed.");
}

export async function setBookingsOpen(fd: FormData) {
  const { supabase } = await assertAdmin();
  const open = fd.get("open") === "true";
  const { error } = await supabase.rpc("admin_set_bookings_open", { p_open: open });
  if (error) back("/admin/availability", error.message, "err");
  revalidatePublic();
  back("/admin/availability", open ? "Bookings are OPEN." : "All bookings CLOSED. Students can't start any new payment.");
}

export async function saveBookingRules(fd: FormData) {
  const { supabase } = await assertAdmin();
  const { data } = await supabase.from("site_settings").select("value").eq("key", "booking").maybeSingle();
  const clamp = (v: unknown, lo: number, hi: number, d: number) => Math.max(lo, Math.min(hi, Number(v) || d));
  const value = {
    ...(data?.value ?? {}),
    hold_minutes: clamp(fd.get("hold_minutes"), 5, 30, 10),
    min_notice_hours: clamp(fd.get("min_notice_hours"), 0, 168, 2),
    max_days_ahead: clamp(fd.get("max_days_ahead"), 1, 365, 60),
  };
  await supabase.from("site_settings").upsert({ key: "booking", value });
  back("/admin/availability", "Booking rules saved.");
}

// ───────────────────────── Bookings ─────────────────────────

export async function updateBooking(fd: FormData) {
  const { supabase } = await assertAdmin();
  const id = uuid(fd.get("id"));
  const action = String(fd.get("action"));
  const ret = String(fd.get("return") || "/admin/bookings");
  const now = new Date().toISOString();
  let patch: Record<string, unknown> = {};
  if (action === "link") {
    const link = cleanText(fd.get("meeting_link"), 500);
    if (link && !/^https:\/\//.test(link)) back(ret, "Class link must start with https://", "err");
    patch = { meeting_link: link || null };
  } else if (action === "note") patch = { admin_note: cleanText(fd.get("admin_note"), 500) || null };
  else if (action === "complete") patch = { status: "completed" };
  else if (action === "accept") {
    patch = { status: "confirmed", confirmed_at: now };
    const { data: b } = await supabase.from("bookings").select("order_id, status").eq("id", id).single();
    if (b?.status !== "needs_review") back(ret, "Only bookings under review can be accepted.", "err");
    if (b?.order_id) await supabase.from("orders").update({ status: "paid" }).eq("id", b.order_id);
  } else if (action === "cancel") patch = { status: "cancelled", cancelled_at: now };
  else back(ret, "Unknown action", "err");
  // Admin updates go through RLS (admin-only policy). Status/payment columns are never writable by students.
  const { error } = await supabase.from("bookings").update(patch).eq("id", id);
  if (error) back(ret, error.message, "err");
  revalidatePath("/admin/bookings");
  back(ret, "Booking updated.");
}

/** Refund an order: through Razorpay (online) or just record a refund you did manually. */
export async function refundOrder(fd: FormData) {
  const { user } = await assertAdmin();
  const orderId = uuid(fd.get("order_id"));
  const ret = String(fd.get("return") || "/admin/orders");
  const mode = String(fd.get("mode"));
  const reason = cleanText(fd.get("reason"), 300) || null;
  const db = createServiceClient();
  const { data: o } = await db.from("orders").select("id, amount_paise, status, razorpay_payment_id, kind").eq("id", orderId).single();
  if (!o || !["paid", "needs_review", "partially_refunded"].includes(o.status)) back(ret, "This order can't be refunded.", "err");
  const { data: prev } = await db.from("refunds").select("amount_paise").eq("order_id", orderId).neq("status", "failed");
  const already = (prev ?? []).reduce((s, r) => s + r.amount_paise, 0);
  const rupees = Number(fd.get("amount"));
  const amount = Math.round((rupees > 0 ? rupees : (o!.amount_paise - already) / 100) * 100);
  if (amount <= 0 || amount + already > o!.amount_paise) back(ret, "Refund amount is more than what's left to refund.", "err");

  let razorpay_refund_id: string | null = null;
  let status = "recorded";
  if (mode === "razorpay") {
    if (!o!.razorpay_payment_id) back(ret, "No Razorpay payment on this order.", "err");
    try {
      const r = await razorpay().payments.refund(o!.razorpay_payment_id!, { amount, notes: { reason: reason ?? "" } });
      razorpay_refund_id = r.id;
      status = r.status === "processed" ? "processed" : "pending";
    } catch (e) {
      back(ret, `Razorpay refund failed: ${String((e as { error?: { description?: string } })?.error?.description ?? e)}`, "err");
    }
  }
  await db.from("refunds").insert({ order_id: orderId, amount_paise: amount, razorpay_refund_id, status, reason, created_by: user.id });
  const full = amount + already >= o!.amount_paise;
  await db.from("orders").update({ status: full ? "refunded" : "partially_refunded" }).eq("id", orderId);
  if (o!.kind === "booking" && full) {
    await db.from("bookings").update({ status: "refunded", cancelled_at: new Date().toISOString() }).eq("order_id", orderId).in("status", ["needs_review", "confirmed", "cancelled"]);
  }
  revalidatePath(ret.split("?")[0]);
  back(ret, mode === "razorpay" ? "Refund sent through Razorpay." : "Refund recorded.");
}

// ───────────────────────── Notes ─────────────────────────

export async function saveNote(fd: FormData) {
  const { supabase } = await assertAdmin();
  const id = String(fd.get("id") || "");
  const price = Number(fd.get("price"));
  const cls = Number(fd.get("class_level"));
  const board = String(fd.get("board"));
  const subject = String(fd.get("subject"));
  const ret = id ? `/admin/notes/${id}` : "/admin/notes/new";
  if (!(price >= 1 && price <= 100000)) back(ret, "Price must be between ₹1 and ₹1,00,000.", "err");
  if (![8, 9, 10].includes(cls) || !["CBSE", "ICSE"].includes(board)) back(ret, "Choose class and board.", "err");
  if (!["Science", "Chemistry", "Physics", "Biology"].includes(subject)) back(ret, "Choose a subject.", "err");
  const previews = String(fd.get("preview_paths") || "").split("\n").map((s) => s.trim()).filter(Boolean).slice(0, 8);
  const row = {
    title: cleanText(fd.get("title"), 150),
    chapter_no: fd.get("chapter_no") ? Number(fd.get("chapter_no")) : null,
    class_level: cls,
    board,
    subject,
    description: cleanText(fd.get("description"), 2000),
    price_paise: Math.round(price * 100),
    pages: fd.get("pages") ? Number(fd.get("pages")) : null,
    cover_path: cleanText(fd.get("cover_path"), 300) || null,
    preview_paths: previews,
    is_published: bool(fd, "is_published"),
    is_available: bool(fd, "is_available"),
  };
  if (row.title.length < 2) back(ret, "Enter a chapter title.", "err");
  const pdfPath = cleanText(fd.get("pdf_path"), 300);
  if (row.is_available && !pdfPath) back(ret, "Upload the PDF before marking the chapter available for purchase.", "err");

  let noteId = id;
  if (id) {
    const { error } = await supabase.from("notes").update(row).eq("id", uuid(id));
    if (error) back(ret, error.message, "err");
  } else {
    const { data, error } = await supabase.from("notes").insert(row).select("id").single();
    if (error || !data) back(ret, error?.message ?? "Could not save", "err");
    noteId = data!.id;
  }
  if (pdfPath) {
    const size = Number(fd.get("pdf_size")) || null;
    await supabase.from("note_files").upsert({ note_id: noteId, pdf_path: pdfPath, size_bytes: size, uploaded_at: new Date().toISOString() });
  }
  revalidatePublic();
  back(`/admin/notes/${noteId}`, "Saved.");
}

export async function quickNoteToggle(fd: FormData) {
  const { supabase } = await assertAdmin();
  const id = uuid(fd.get("id"));
  const field = String(fd.get("field"));
  if (!["is_published", "is_available"].includes(field)) back("/admin/notes", "Bad field", "err");
  const value = fd.get("value") === "true";
  if (field === "is_available" && value) {
    const { data } = await supabase.from("note_files").select("note_id").eq("note_id", id).maybeSingle();
    if (!data) back("/admin/notes", "Upload a PDF before making this chapter available.", "err");
  }
  await supabase.from("notes").update({ [field]: value }).eq("id", id);
  revalidatePublic();
  back("/admin/notes", "Updated.");
}

export async function deleteNote(fd: FormData) {
  const { supabase } = await assertAdmin();
  const id = uuid(fd.get("id"));
  const { data: sold } = await supabase.from("order_items").select("id").eq("note_id", id).limit(1);
  if (sold?.length) back(`/admin/notes/${id}`, "This chapter has been sold, so it can't be deleted (buyers keep access). Unpublish it instead.", "err");
  const { data: f } = await supabase.from("note_files").select("pdf_path").eq("note_id", id).maybeSingle();
  if (f?.pdf_path) await supabase.storage.from("notes-pdf").remove([f.pdf_path]);
  await supabase.from("notes").delete().eq("id", id);
  revalidatePublic();
  back("/admin/notes", "Chapter deleted.");
}

export async function bulkPrice(fd: FormData) {
  const { supabase } = await assertAdmin();
  const price = Number(fd.get("price"));
  if (!(price >= 1 && price <= 100000)) back("/admin/notes", "Enter a valid price.", "err");
  let q = supabase.from("notes").update({ price_paise: Math.round(price * 100) });
  const cls = Number(fd.get("class_level"));
  const board = String(fd.get("board") || "");
  if (cls) q = q.eq("class_level", cls);
  if (board) q = q.eq("board", board);
  const { error } = await q.gte("price_paise", 0);
  if (error) back("/admin/notes", error.message, "err");
  revalidatePublic();
  back("/admin/notes", "Prices updated.");
}

// ───────────────────────── Content ─────────────────────────

const SITE_KEYS = [
  "tagline", "hero_title", "hero_subtitle", "about", "contact_email", "whatsapp_number", "youtube_channel_url",
  "instagram_url", "facebook_url", "x_url", "telegram_url", "business_name", "business_address", "ga_measurement_id", "google_site_verification",
] as const;

export async function saveSite(fd: FormData) {
  const { supabase } = await assertAdmin();
  const value: Record<string, string> = {};
  for (const k of SITE_KEYS) value[k] = cleanText(fd.get(k), k === "about" || k === "hero_subtitle" || k === "business_address" ? 1000 : 300);
  for (const k of ["youtube_channel_url", "instagram_url", "facebook_url", "x_url", "telegram_url"] as const) {
    if (value[k] && !/^https:\/\//.test(value[k])) back("/admin/content", `${k.replace(/_/g, " ")} must start with https://`, "err");
  }
  if (value.ga_measurement_id && !/^G-[A-Z0-9]{4,}$/.test(value.ga_measurement_id)) back("/admin/content", "Google Analytics ID should look like G-XXXXXXX.", "err");
  const verification = value.google_site_verification.match(/content="([^"]+)"/);
  if (verification) value.google_site_verification = verification[1];
  const { error } = await supabase.from("site_settings").upsert({ key: "site", value });
  if (error) back("/admin/content", error.message, "err");
  revalidatePublic();
  back("/admin/content", "Website content saved.");
}

export async function savePricing(fd: FormData) {
  const { supabase } = await assertAdmin();
  const n = (k: string) => Number(fd.get(k));
  const value = { note_default: n("note_default"), tuition_per_hour: n("tuition_per_hour"), doubt_30: n("doubt_30"), doubt_60: n("doubt_60") };
  if (Object.values(value).some((v) => !(v >= 1 && v <= 100000))) back("/admin/content", "Prices must be between ₹1 and ₹1,00,000.", "err");
  await supabase.from("site_settings").upsert({ key: "pricing", value });
  revalidatePublic();
  back("/admin/content", "Prices saved. New bookings use these prices; existing holds keep their price.");
}

export async function savePolicy(fd: FormData) {
  const { supabase } = await assertAdmin();
  const slug = String(fd.get("slug"));
  if (!POLICY_SLUGS.includes(slug as never)) back("/admin/content", "Unknown policy", "err");
  const text = String(fd.get("text") || "").slice(0, 30000).trim();
  if (text) await supabase.from("site_settings").upsert({ key: `policy_${slug}`, value: { text } });
  else await supabase.from("site_settings").delete().eq("key", `policy_${slug}`);
  revalidatePath(`/policies/${slug}`);
  back("/admin/content#policies", text ? "Policy saved." : "Policy reset to default.");
}

// Generic CRUD for videos / FAQs / testimonials
type Table = "videos" | "faqs" | "testimonials";
const TABLES: Record<Table, string> = { videos: "/admin/videos", faqs: "/admin/faqs", testimonials: "/admin/testimonials" };

export async function saveRow(fd: FormData) {
  const { supabase } = await assertAdmin();
  const table = String(fd.get("table")) as Table;
  if (!(table in TABLES)) throw new Error("bad table");
  const P = TABLES[table];
  const id = String(fd.get("id") || "");
  let row: Record<string, unknown>;
  if (table === "videos") {
    const url = cleanText(fd.get("youtube_url"), 300);
    if (!/^https:\/\/(www\.|m\.)?(youtube\.com|youtu\.be)\//i.test(url)) back(P, "Paste a full YouTube link (https://youtube.com/… or https://youtu.be/…).", "err");
    const thumb = cleanText(fd.get("thumbnail_url"), 300);
    if (thumb && !/^https:\/\/(i\.ytimg\.com|img\.youtube\.com)\//.test(thumb)) back(P, "Custom thumbnails must be YouTube image links (i.ytimg.com). Leave blank to use YouTube's own thumbnail.", "err");
    row = {
      youtube_url: url,
      title: cleanText(fd.get("title"), 200),
      thumbnail_url: thumb || null,
      class_level: Number(fd.get("class_level")) || null,
      board: ["CBSE", "ICSE"].includes(String(fd.get("board"))) ? String(fd.get("board")) : null,
      chapter: cleanText(fd.get("chapter"), 150) || null,
    };
  } else if (table === "faqs") {
    row = { question: cleanText(fd.get("question"), 300), answer: cleanText(fd.get("answer"), 2000) };
  } else {
    row = { author_name: cleanText(fd.get("author_name"), 80), author_detail: cleanText(fd.get("author_detail"), 120) || null, quote: cleanText(fd.get("quote"), 1000) };
  }
  row.is_published = bool(fd, "is_published");
  row.sort_order = Number(fd.get("sort_order")) || 0;
  const { error } = id ? await supabase.from(table).update(row).eq("id", uuid(id)) : await supabase.from(table).insert(row);
  if (error) back(P, error.message, "err");
  revalidatePublic();
  back(P, "Saved.");
}

export async function deleteRow(fd: FormData) {
  const { supabase } = await assertAdmin();
  const table = String(fd.get("table")) as Table;
  if (!(table in TABLES)) throw new Error("bad table");
  await supabase.from(table).delete().eq("id", uuid(fd.get("id")));
  revalidatePublic();
  back(TABLES[table], "Deleted.");
}

export async function markMessage(fd: FormData) {
  const { supabase } = await assertAdmin();
  const id = uuid(fd.get("id"));
  if (fd.get("delete") === "true") await supabase.from("contact_messages").delete().eq("id", id);
  else await supabase.from("contact_messages").update({ is_read: fd.get("read") === "true" }).eq("id", id);
  back("/admin/messages", "Updated.");
}
