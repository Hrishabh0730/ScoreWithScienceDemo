export const TZ = "Asia/Kolkata";

export function inr(paise: number): string {
  const rupees = paise / 100;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: Number.isInteger(rupees) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(rupees);
}

export function fmtDate(iso: string | Date, opts: Intl.DateTimeFormatOptions = {}) {
  return new Intl.DateTimeFormat("en-IN", { timeZone: TZ, dateStyle: "medium", ...opts }).format(new Date(iso));
}

export function fmtDateTime(iso: string | Date) {
  return new Intl.DateTimeFormat("en-IN", { timeZone: TZ, dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
}

export function fmtTime(iso: string | Date) {
  return new Intl.DateTimeFormat("en-IN", { timeZone: TZ, hour: "numeric", minute: "2-digit" }).format(new Date(iso));
}

export function fmtDayKey(iso: string | Date) {
  // YYYY-MM-DD in IST
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
}

export function fmtWeekday(iso: string | Date) {
  return new Intl.DateTimeFormat("en-IN", { timeZone: TZ, weekday: "short", day: "numeric", month: "short" }).format(new Date(iso));
}

/** Convert a date ("2026-12-01") and time ("16:30") entered in IST to a UTC ISO string. */
export function istToIso(date: string, time: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) throw new Error("Invalid date/time");
  return new Date(`${date}T${time}:00+05:30`).toISOString();
}

export function minutesLabel(m: number) {
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h} hr ${r} min` : `${h} hr`;
}

export function youtubeId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname === "youtu.be") return u.pathname.slice(1).split("/")[0] || null;
    if (u.hostname.endsWith("youtube.com")) {
      if (u.searchParams.get("v")) return u.searchParams.get("v");
      const m = u.pathname.match(/\/(shorts|embed|live)\/([\w-]{6,})/);
      if (m) return m[2];
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function videoThumb(v: { youtube_url: string; thumbnail_url: string | null }) {
  if (v.thumbnail_url) return v.thumbnail_url;
  const id = youtubeId(v.youtube_url);
  return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null;
}

export function cleanText(v: FormDataEntryValue | null, max = 500): string {
  return String(v ?? "").trim().slice(0, max);
}

/** Current time (server-side helper; keeps render code free of direct Date.now calls). */
export function nowMs() {
  return Date.now();
}
