"use client";
import { useState } from "react";

export function ContactForm() {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState("sending");
    const fd = new FormData(e.currentTarget);
    const res = await fetch("/api/contact", { method: "POST", body: JSON.stringify(Object.fromEntries(fd)), headers: { "Content-Type": "application/json" } });
    if (res.ok) {
      setState("sent");
      (e.target as HTMLFormElement).reset();
    } else {
      const j = await res.json().catch(() => ({}));
      setError(j.error || "Something went wrong. Please try again.");
      setState("error");
    }
  }

  if (state === "sent") {
    return (
      <div className="card p-6 text-center" role="status">
        <p className="text-lg font-bold text-navy-900">Thanks — message received!</p>
        <p className="mt-1 text-muted">We usually reply within a day.</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="card grid gap-4 p-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="c-name">Name</label>
          <input id="c-name" name="name" required maxLength={100} className="input" autoComplete="name" />
        </div>
        <div>
          <label className="label" htmlFor="c-email">Email</label>
          <input id="c-email" name="email" type="email" required maxLength={200} className="input" autoComplete="email" />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="c-phone">Phone <span className="font-normal text-muted">(optional)</span></label>
        <input id="c-phone" name="phone" type="tel" maxLength={16} className="input" autoComplete="tel" />
      </div>
      <div>
        <label className="label" htmlFor="c-msg">Message</label>
        <textarea id="c-msg" name="message" required minLength={5} maxLength={3000} rows={5} className="input" />
      </div>
      {/* honeypot */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
      {state === "error" && <p className="text-sm font-semibold text-red-700" role="alert">{error}</p>}
      <button className="btn-primary justify-self-start" disabled={state === "sending"}>
        {state === "sending" ? "Sending…" : "Send message"}
      </button>
    </form>
  );
}
