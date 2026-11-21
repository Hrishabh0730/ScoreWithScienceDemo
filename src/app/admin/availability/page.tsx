import { requireAdmin } from "@/lib/auth";
import { getSettings } from "@/lib/data";
import { fmtDateTime, fmtDayKey, fmtTime, fmtWeekday, minutesLabel } from "@/lib/format";
import { addBlock, closeDaySlots, createSlots, removeBlock, removeSlot, saveBookingRules, setBookingsOpen, setSlotOpen, updateSlot } from "../actions";
import { ConfirmButton } from "../ConfirmButton";
import { AdminHeader, Check, Field, Flash, Panel, type SP } from "../ui";

interface SlotRow {
  id: string;
  start_at: string;
  end_at: string;
  duration_minutes: number;
  allow_tuition: boolean;
  allow_doubt: boolean;
  capacity: number;
  is_open: boolean;
  note: string | null;
  bookings: { status: string; hold_expires_at: string | null; profiles: { full_name: string } | null }[];
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default async function Availability({ searchParams }: { searchParams: SP }) {
  const { supabase } = await requireAdmin();
  const { booking } = await getSettings();
  const now = new Date().toISOString();
  const [{ data: slots }, { data: blocks }] = await Promise.all([
    supabase
      .from("slots")
      .select("id, start_at, end_at, duration_minutes, allow_tuition, allow_doubt, capacity, is_open, note, bookings(status, hold_expires_at, profiles(full_name))")
      .eq("archived", false)
      .gt("end_at", now)
      .order("start_at")
      .limit(400),
    supabase.from("blocked_periods").select("*").gt("end_at", now).order("start_at"),
  ]);
  const today = fmtDayKey(new Date());
  const byDay = new Map<string, SlotRow[]>();
  ((slots ?? []) as unknown as SlotRow[]).forEach((s) => {
    const k = fmtDayKey(s.start_at);
    byDay.set(k, [...(byDay.get(k) ?? []), s]);
  });

  return (
    <>
      <AdminHeader title="Availability" lead="Students can only book slots you open here. Nothing is bookable unless you allow it." />
      <Flash searchParams={searchParams} />

      <div className={`mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border p-5 ${booking.bookings_open ? "border-teal-100 bg-teal-50" : "border-red-200 bg-red-50"}`}>
        <div>
          <p className="text-lg font-extrabold text-navy-900">Bookings are {booking.bookings_open ? "OPEN" : "CLOSED"}</p>
          <p className="text-sm text-muted">
            {booking.bookings_open ? "Students can book your open slots." : "Every slot is hidden and no payment can start, even for open slots."}
          </p>
        </div>
        <form action={setBookingsOpen}>
          <input type="hidden" name="open" value={booking.bookings_open ? "false" : "true"} />
          {booking.bookings_open ? (
            <ConfirmButton className="btn-danger" message="Close ALL bookings now? Any payment in progress will be cancelled.">Close all bookings now</ConfirmButton>
          ) : (
            <ConfirmButton className="btn-primary">Open bookings</ConfirmButton>
          )}
        </form>
      </div>

      <Panel title="Open new slots">
        <form action={createSlots} className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="From date"><input type="date" name="date_from" required min={today} defaultValue={today} className="input" /></Field>
            <Field label="To date" hint="Same as From for a single day"><input type="date" name="date_to" min={today} className="input" /></Field>
            <Field label="Start time (IST)"><input type="time" name="start_time" required defaultValue="17:00" step={900} className="input" /></Field>
            <Field label="End time (IST)"><input type="time" name="end_time" required defaultValue="19:00" step={900} className="input" /></Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Slot length" hint="The window is split into slots of this length">
              <select name="slot_minutes" className="input" defaultValue="60">
                <option value="30">30 minutes</option>
                <option value="60">60 minutes</option>
                <option value="90">90 minutes (tuition only)</option>
                <option value="120">120 minutes (tuition only)</option>
              </select>
            </Field>
            <Field label="Max students per slot" hint="Keep 1 for one-to-one"><input type="number" name="capacity" min={1} max={50} defaultValue={1} className="input" /></Field>
            <Field label="Private note (optional)"><input name="note" maxLength={200} className="input" /></Field>
          </div>
          <div>
            <span className="label">Repeat on (leave all unticked = every day)</span>
            <div className="flex flex-wrap gap-3">
              {WEEKDAYS.map((d, i) => (
                <label key={d} className="inline-flex items-center gap-1.5 text-sm font-semibold">
                  <input type="checkbox" name="weekday" value={i} className="h-4 w-4 accent-navy-800" /> {d}
                </label>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-5">
            <Check name="allow_tuition" label="Allow tuition" defaultChecked />
            <Check name="allow_doubt" label="Allow doubt sessions" defaultChecked />
          </div>
          <p className="text-xs text-muted">Doubt sessions can only use 30- or 60-minute slots. Overlapping slots are skipped automatically.</p>
          <button className="btn-primary justify-self-start">Open slots</button>
        </form>
      </Panel>

      <Panel title="Upcoming slots">
        {byDay.size === 0 ? (
          <p className="text-sm text-muted">No upcoming slots. Open some above.</p>
        ) : (
          <div className="space-y-6">
            {[...byDay.entries()].map(([day, list]) => (
              <div key={day}>
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="font-bold text-navy-900">{fmtWeekday(list[0].start_at)}</h3>
                  <form action={closeDaySlots}>
                    <input type="hidden" name="day" value={day} />
                    <ConfirmButton message={`Close every open slot on ${day}?`} className="btn-ghost btn-sm">Close whole day</ConfirmButton>
                  </form>
                </div>
                <div className="grid gap-2">
                  {list.map((s) => {
                    const taken = s.bookings.filter((b) => ["confirmed", "completed"].includes(b.status)).length;
                    const holds = s.bookings.filter((b) => b.status === "pending_payment" && b.hold_expires_at && new Date(b.hold_expires_at) > new Date()).length;
                    const names = s.bookings.filter((b) => ["confirmed", "completed", "needs_review"].includes(b.status)).map((b) => b.profiles?.full_name).filter(Boolean);
                    return (
                      <details key={s.id} className={`rounded-xl border p-3 ${s.is_open ? "border-line bg-white" : "border-dashed border-slate-300 bg-slate-50"}`}>
                        <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2">
                          <span className="font-semibold">
                            {fmtTime(s.start_at)}–{fmtTime(s.end_at)} <span className="text-muted">· {minutesLabel(s.duration_minutes)}</span>
                          </span>
                          <span className="flex flex-wrap gap-1.5">
                            {s.allow_tuition && <span className="chip bg-navy-50 text-navy-800">Tuition</span>}
                            {s.allow_doubt && <span className="chip bg-saffron-50 text-saffron-600">Doubt</span>}
                            <span className="chip bg-slate-100 text-slate-700">{taken}/{s.capacity} booked</span>
                            {holds > 0 && <span className="chip bg-amber-50 text-amber-800">{holds} paying now</span>}
                            <span className={`chip ${s.is_open ? "bg-teal-50 text-teal-700" : "bg-red-50 text-red-700"}`}>{s.is_open ? "Open" : "Closed"}</span>
                          </span>
                        </summary>
                        <div className="mt-3 grid gap-3 border-t border-line pt-3">
                          {names.length > 0 && <p className="text-sm">Booked by: {names.join(", ")}</p>}
                          <form action={updateSlot} className="flex flex-wrap items-end gap-3">
                            <input type="hidden" name="id" value={s.id} />
                            <Check name="allow_tuition" label="Tuition" defaultChecked={s.allow_tuition} />
                            <Check name="allow_doubt" label="Doubt" defaultChecked={s.allow_doubt} />
                            <label className="text-sm font-semibold">Capacity <input type="number" name="capacity" min={1} max={50} defaultValue={s.capacity} className="input !w-20" /></label>
                            <input name="note" defaultValue={s.note ?? ""} placeholder="Note" className="input !w-48" />
                            <button className="btn-outline btn-sm">Save</button>
                          </form>
                          <div className="flex flex-wrap gap-2">
                            <form action={setSlotOpen}>
                              <input type="hidden" name="id" value={s.id} />
                              <input type="hidden" name="open" value={s.is_open ? "false" : "true"} />
                              <ConfirmButton className={s.is_open ? "btn-outline btn-sm" : "btn-primary btn-sm"} message={s.is_open ? "Close this slot? Any payment in progress for it is cancelled." : undefined}>
                                {s.is_open ? "Close slot" : "Reopen slot"}
                              </ConfirmButton>
                            </form>
                            <form action={removeSlot}>
                              <input type="hidden" name="id" value={s.id} />
                              <ConfirmButton className="btn-ghost btn-sm text-red-700" message="Remove this slot?">Remove</ConfirmButton>
                            </form>
                          </div>
                        </div>
                      </details>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <Panel title="Block dates or hours" id="blocks">
        <form action={addBlock} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6 lg:items-end">
          <Field label="From date"><input type="date" name="day" required min={today} className="input" /></Field>
          <Field label="To date"><input type="date" name="day_to" min={today} className="input" /></Field>
          <Field label="From time"><input type="time" name="from" defaultValue="09:00" className="input" /></Field>
          <Field label="To time"><input type="time" name="to" defaultValue="21:00" className="input" /></Field>
          <Field label="Reason (private)"><input name="reason" maxLength={200} className="input" /></Field>
          <div className="grid gap-2">
            <Check name="whole_day" label="Whole day(s)" defaultChecked />
            <button className="btn-primary btn-sm">Block</button>
          </div>
        </form>
        {(blocks?.length ?? 0) > 0 && (
          <ul className="mt-5 divide-y divide-line text-sm">
            {blocks!.map((b) => (
              <li key={b.id} className="flex items-center justify-between gap-3 py-2">
                <span>{fmtDateTime(b.start_at)} → {fmtDateTime(b.end_at)} {b.reason && <span className="text-muted">· {b.reason}</span>}</span>
                <form action={removeBlock}>
                  <input type="hidden" name="id" value={b.id} />
                  <button className="btn-ghost btn-sm">Unblock</button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Booking rules">
        <form action={saveBookingRules} className="grid gap-4 sm:grid-cols-4 sm:items-end">
          <Field label="Hold slot while paying (min)"><input type="number" name="hold_minutes" min={5} max={30} defaultValue={booking.hold_minutes} className="input" /></Field>
          <Field label="Minimum notice (hours)"><input type="number" name="min_notice_hours" min={0} max={168} defaultValue={booking.min_notice_hours} className="input" /></Field>
          <Field label="Book up to (days ahead)"><input type="number" name="max_days_ahead" min={1} max={365} defaultValue={booking.max_days_ahead} className="input" /></Field>
          <button className="btn-outline">Save rules</button>
        </form>
      </Panel>
    </>
  );
}
