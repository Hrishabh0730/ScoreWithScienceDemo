"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Notice } from "@/components/ui";
import { useRazorpay } from "@/components/useRazorpay";
import { fmtDayKey, fmtTime, fmtWeekday, inr, minutesLabel } from "@/lib/format";
import type { AvailableSlot, Service } from "@/lib/types";

const PREF_KEY = "sws-class-board";

export function BookingFlow({ service }: { service: Service }) {
  const router = useRouter();
  const pay = useRazorpay();
  const [slots, setSlots] = useState<AvailableSlot[] | null>(null);
  const [classLevel, setClassLevel] = useState<8 | 9 | 10 | null>(null);
  const [board, setBoard] = useState<"CBSE" | "ICSE" | null>(null);
  const [duration, setDuration] = useState<number | null>(null);
  const [day, setDay] = useState<string | null>(null);
  const [slotId, setSlotId] = useState<string | null>(null);
  const [topic, setTopic] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "error" | "warn" | "info"; text: string; login?: boolean } | null>(null);

  const load = useCallback(async () => {
    const r = await fetch(`/api/slots?service=${service}`, { cache: "no-store" });
    const j = await r.json().catch(() => ({ slots: [] }));
    setSlots(j.slots || []);
  }, [service]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data load
    load();
    try {
      const p = JSON.parse(localStorage.getItem(PREF_KEY) || "{}");
      if ([8, 9, 10].includes(p.c)) setClassLevel(p.c);
      if (["CBSE", "ICSE"].includes(p.b)) setBoard(p.b);
    } catch {
      /* ignore */
    }
  }, [load]);

  useEffect(() => {
    if (classLevel && board) {
      try {
        localStorage.setItem(PREF_KEY, JSON.stringify({ c: classLevel, b: board }));
      } catch {
        /* ignore */
      }
    }
  }, [classLevel, board]);

  const durations = useMemo(() => {
    const all = [...new Set((slots ?? []).map((s) => s.minutes))].sort((a, b) => a - b);
    return service === "doubt" ? [30, 60] : all.length ? all : [60];
  }, [slots, service]);
  const filtered = useMemo(() => (slots ?? []).filter((s) => !duration || s.minutes === duration), [slots, duration]);
  const days = useMemo(() => [...new Set(filtered.map((s) => fmtDayKey(s.start_at)))], [filtered]);
  const daySlots = filtered.filter((s) => fmtDayKey(s.start_at) === day);
  const selected = (slots ?? []).find((s) => s.slot_id === slotId) || null;

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- keep selection valid as filters change
    if (day && !days.includes(day)) setDay(null);
    if (slotId && !filtered.some((s) => s.slot_id === slotId)) setSlotId(null);
  }, [days, day, filtered, slotId]);

  async function book() {
    if (!selected || !classLevel || !board) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/bookings/reserve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slotId: selected.slot_id, service, classLevel, board, topic: topic.trim() || undefined }),
      });
      const j = await res.json();
      if (!res.ok) {
        if (res.status === 401) {
          setMsg({ tone: "info", text: "Please log in or create a free account to book.", login: true });
        } else {
          setMsg({ tone: "error", text: j.error || "Could not book this slot." });
          load();
        }
        return;
      }
      let result;
      let failure = "";
      try {
        result = await pay(
          {
            keyId: j.keyId,
            razorpayOrderId: j.razorpayOrderId,
            amount: j.amount,
            currency: j.currency,
            description: j.description,
            prefill: j.prefill,
            timeoutSeconds: j.timeoutSeconds,
          },
          (m) => {
            failure = m;
            setMsg({ tone: "warn", text: `Payment failed: ${m}. You can retry in the payment window.` });
          },
        );
      } catch (e) {
        await fetch("/api/bookings/release", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ bookingId: j.bookingId }) });
        const dismissed = (e as Error).message === "dismissed";
        setMsg({
          tone: failure ? "error" : "info",
          text: failure
            ? `Payment failed: ${failure}. No money was taken and the slot was released — please try again.`
            : dismissed
              ? "Payment window closed and the slot was released. If you already paid (e.g. approved in your UPI app), it will still be confirmed automatically — check My account."
              : (e as Error).message,
        });
        load();
        return;
      }
      const v = await fetch("/api/payments/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(result) });
      const vj = await v.json().catch(() => ({}));
      router.push(`/checkout/complete?order=${encodeURIComponent(j.orderNumber)}${vj.ok ? "" : "&pending=1"}`);
    } finally {
      setBusy(false);
    }
  }

  const loginNext = service === "tuition" ? "/tuition#book" : "/doubts#book";

  return (
    <div id="book" className="card scroll-mt-24 p-5 sm:p-8">
      <h2 className="text-2xl font-extrabold text-navy-900">Book {service === "tuition" ? "a tuition class" : "a doubt session"}</h2>
      <p className="mt-1 text-sm text-muted">All times are in IST. Only slots the teacher has opened are shown.</p>

      <Step n={1} title="Your class and board">
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Class">
          {([8, 9, 10] as const).map((c) => (
            <Pill key={c} active={classLevel === c} onClick={() => setClassLevel(c)}>Class {c}</Pill>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label="Board">
          {(["CBSE", "ICSE"] as const).map((b) => (
            <Pill key={b} active={board === b} onClick={() => setBoard(b)}>{b}</Pill>
          ))}
        </div>
      </Step>

      <Step n={2} title="Session length">
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Duration">
          {durations.map((m) => (
            <Pill key={m} active={duration === m} onClick={() => setDuration(duration === m ? null : m)}>
              {minutesLabel(m)}
            </Pill>
          ))}
        </div>
      </Step>

      <Step n={3} title="Pick a date and time">
        {slots === null ? (
          <p className="text-sm text-muted">Loading available slots…</p>
        ) : filtered.length === 0 ? (
          <Notice tone="info">
            No open slots right now{duration ? ` for ${minutesLabel(duration)}` : ""}. New slots are added regularly — please check back, or{" "}
            <Link className="underline" href="/contact">contact us</Link>.
          </Notice>
        ) : (
          <>
            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2" role="radiogroup" aria-label="Date">
              {days.map((d) => {
                const first = filtered.find((s) => fmtDayKey(s.start_at) === d)!;
                return (
                  <Pill key={d} active={day === d} onClick={() => setDay(d)}>
                    {fmtWeekday(first.start_at)}
                  </Pill>
                );
              })}
            </div>
            {day && (
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Time">
                {daySlots.map((s) => (
                  <button
                    key={s.slot_id}
                    type="button"
                    role="radio"
                    aria-checked={slotId === s.slot_id}
                    onClick={() => setSlotId(s.slot_id)}
                    className={`rounded-xl border p-3 text-left transition ${
                      slotId === s.slot_id ? "border-navy-800 bg-navy-800 text-white" : "border-line bg-white hover:border-navy-600/40"
                    }`}
                  >
                    <span className="block font-bold">{fmtTime(s.start_at)} – {fmtTime(s.end_at)}</span>
                    <span className={`text-xs ${slotId === s.slot_id ? "text-navy-100" : "text-muted"}`}>
                      {minutesLabel(s.minutes)} · {inr(s.price_paise)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </Step>

      <Step n={4} title={service === "doubt" ? "What's your doubt about? (optional)" : "Topic or chapter (optional)"}>
        <textarea
          className="input"
          rows={2}
          maxLength={500}
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder={service === "doubt" ? "e.g. Balancing redox equations" : "e.g. Mole concept"}
        />
      </Step>

      <div className="mt-6 rounded-2xl bg-navy-50 p-5">
        <h3 className="font-bold text-navy-900">Summary</h3>
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <dt className="text-muted">Session</dt>
          <dd className="font-semibold">{service === "tuition" ? "1-on-1 Chemistry tuition" : "Chemistry doubt session"} (online)</dd>
          <dt className="text-muted">Class / board</dt>
          <dd className="font-semibold">{classLevel && board ? `Class ${classLevel} · ${board}` : "—"}</dd>
          <dt className="text-muted">When</dt>
          <dd className="font-semibold">{selected ? `${fmtWeekday(selected.start_at)}, ${fmtTime(selected.start_at)} IST` : "—"}</dd>
          <dt className="text-muted">Duration</dt>
          <dd className="font-semibold">{selected ? minutesLabel(selected.minutes) : "—"}</dd>
          <dt className="text-muted">Price</dt>
          <dd className="text-lg font-extrabold text-navy-900">{selected ? inr(selected.price_paise) : "—"}</dd>
        </dl>
        {msg && (
          <div className="mt-4">
            <Notice tone={msg.tone}>
              {msg.text}{" "}
              {msg.login && (
                <>
                  <Link className="font-bold underline" href={`/login?next=${encodeURIComponent(loginNext)}`}>Log in</Link> ·{" "}
                  <Link className="font-bold underline" href={`/register?next=${encodeURIComponent(loginNext)}`}>Sign up</Link>
                </>
              )}
            </Notice>
          </div>
        )}
        <button className="btn-accent mt-5 w-full sm:w-auto" disabled={!selected || !classLevel || !board || busy} onClick={book}>
          {busy ? "Checking slot…" : selected ? `Reserve & pay ${inr(selected.price_paise)}` : "Choose a slot to continue"}
        </button>
        <p className="mt-3 text-xs text-muted">
          The slot is held for you for a few minutes while you pay. Your booking is confirmed only after payment is verified. See the{" "}
          <Link className="underline" href="/policies/booking">booking policy</Link>.
        </p>
      </div>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <fieldset className="mt-7">
      <legend className="mb-3 flex items-center gap-2.5 font-bold text-navy-900">
        <span className="grid h-7 w-7 place-items-center rounded-full bg-saffron-100 text-sm text-saffron-600">{n}</span>
        {title}
      </legend>
      {children}
    </fieldset>
  );
}

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={`shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition min-h-10 ${
        active ? "border-navy-800 bg-navy-800 text-white" : "border-line bg-white text-navy-900 hover:border-navy-600/40"
      }`}
    >
      {children}
    </button>
  );
}
