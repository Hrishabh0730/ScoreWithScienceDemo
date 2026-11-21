import "server-only";
import { NextResponse, type NextRequest } from "next/server";

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

export function fail(error: string, status = 400, extra: Record<string, unknown> = {}) {
  return json({ error, ...extra }, status);
}

/** Basic CSRF defence for state-changing browser requests. */
export function sameOrigin(req: NextRequest) {
  const origin = req.headers.get("origin");
  if (!origin) return true; // same-origin fetches from some browsers omit it; cookies are SameSite=Lax anyway
  try {
    return new URL(origin).host === req.headers.get("host");
  } catch {
    return false;
  }
}

export const SLOT_ERRORS: Record<string, string> = {
  bookings_closed: "Bookings are closed right now. Please check back later.",
  closed: "This slot has just been closed by the teacher.",
  removed: "This slot is no longer offered.",
  not_found: "This slot does not exist.",
  service_not_offered: "This session type isn't offered in that slot.",
  duration_not_offered: "That session length isn't offered in this slot.",
  in_past: "That slot has already started.",
  too_soon: "That slot starts too soon to book. Please pick a later one.",
  too_far: "That slot is too far ahead to book yet.",
  blocked: "The teacher is unavailable at that time.",
  full: "Sorry — someone just booked that slot. Please pick another.",
};

export function slotErrorMessage(dbMessage: string) {
  if (dbMessage.includes("already_booked")) return "You already have this slot booked or on hold.";
  if (dbMessage.includes("too_many_pending")) return "You have unpaid holds open. Finish or close those payments first.";
  if (dbMessage.includes("invalid_class_or_board")) return "Please choose a valid class and board.";
  if (dbMessage.includes("not_authenticated")) return "Please log in to book.";
  const m = dbMessage.match(/slot_unavailable:(\w+)/);
  if (m) return SLOT_ERRORS[m[1]] || "That slot is not available.";
  return "Could not reserve this slot. Please try another.";
}
