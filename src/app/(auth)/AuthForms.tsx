"use client";
import Link from "next/link";
import { useActionState } from "react";
import { Notice } from "@/components/ui";
import { forgotPassword, login, register, resetPassword, type FormState } from "./actions";

function Submit({ pending, children }: { pending: boolean; children: React.ReactNode }) {
  return (
    <button className="btn-primary w-full" disabled={pending}>
      {pending ? "Please wait…" : children}
    </button>
  );
}

function Status({ state }: { state: FormState }) {
  if (state?.error) return <Notice tone="error">{state.error}</Notice>;
  if (state?.ok) return <Notice tone="success">{state.ok}</Notice>;
  return null;
}

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(login, undefined);
  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="next" value={next} />
      <div>
        <label className="label" htmlFor="email">Email</label>
        <input id="email" name="email" type="email" required autoComplete="email" className="input" />
      </div>
      <div>
        <div className="flex items-baseline justify-between">
          <label className="label" htmlFor="password">Password</label>
          <Link href="/forgot-password" className="text-xs font-semibold text-navy-600 hover:underline">Forgot password?</Link>
        </div>
        <input id="password" name="password" type="password" required autoComplete="current-password" className="input" />
      </div>
      <Status state={state} />
      <Submit pending={pending}>Log in</Submit>
      <p className="text-center text-sm text-muted">
        New here? <Link href={`/register?next=${encodeURIComponent(next)}`} className="font-bold text-navy-800 hover:underline">Create a free account</Link>
      </p>
    </form>
  );
}

export function RegisterForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(register, undefined);
  if (state?.ok) return <Status state={state} />;
  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="next" value={next} />
      <div>
        <label className="label" htmlFor="full_name">Student&apos;s name</label>
        <input id="full_name" name="full_name" required maxLength={100} autoComplete="name" className="input" />
      </div>
      <div>
        <label className="label" htmlFor="email">Email</label>
        <input id="email" name="email" type="email" required autoComplete="email" className="input" />
        <p className="mt-1 text-xs text-muted">A parent&apos;s email is fine.</p>
      </div>
      <div>
        <label className="label" htmlFor="password">Password</label>
        <input id="password" name="password" type="password" minLength={8} required autoComplete="new-password" className="input" />
        <p className="mt-1 text-xs text-muted">At least 8 characters.</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="class_level">Class</label>
          <select id="class_level" name="class_level" required className="input" defaultValue="">
            <option value="" disabled>Select</option>
            <option value="8">Class 8</option>
            <option value="9">Class 9</option>
            <option value="10">Class 10</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="board">Board</label>
          <select id="board" name="board" required className="input" defaultValue="">
            <option value="" disabled>Select</option>
            <option value="CBSE">CBSE</option>
            <option value="ICSE">ICSE</option>
          </select>
        </div>
      </div>
      <div>
        <label className="label" htmlFor="phone">Phone <span className="font-normal text-muted">(optional — parent&apos;s number preferred)</span></label>
        <input id="phone" name="phone" type="tel" maxLength={16} autoComplete="tel" className="input" />
      </div>
      <label className="flex gap-3 text-sm">
        <input type="checkbox" name="guardian_consent" required className="mt-0.5 h-5 w-5 shrink-0 accent-navy-800" />
        <span>I am 18 or older, or my parent/guardian knows about and agrees to this account.</span>
      </label>
      <label className="flex gap-3 text-sm">
        <input type="checkbox" name="terms" required className="mt-0.5 h-5 w-5 shrink-0 accent-navy-800" />
        <span>
          I agree to the <Link href="/policies/terms" className="underline" target="_blank">terms</Link> and{" "}
          <Link href="/policies/privacy" className="underline" target="_blank">privacy policy</Link>.
        </span>
      </label>
      <Status state={state} />
      <Submit pending={pending}>Create account</Submit>
      <p className="text-center text-sm text-muted">
        Already have an account? <Link href={`/login?next=${encodeURIComponent(next)}`} className="font-bold text-navy-800 hover:underline">Log in</Link>
      </p>
    </form>
  );
}

export function ForgotForm() {
  const [state, action, pending] = useActionState(forgotPassword, undefined);
  return (
    <form action={action} className="grid gap-4">
      <div>
        <label className="label" htmlFor="email">Email</label>
        <input id="email" name="email" type="email" required autoComplete="email" className="input" />
      </div>
      <Status state={state} />
      <Submit pending={pending}>Send reset link</Submit>
    </form>
  );
}

export function ResetForm() {
  const [state, action, pending] = useActionState(resetPassword, undefined);
  return (
    <form action={action} className="grid gap-4">
      <div>
        <label className="label" htmlFor="password">New password</label>
        <input id="password" name="password" type="password" minLength={8} required autoComplete="new-password" className="input" />
      </div>
      <div>
        <label className="label" htmlFor="confirm">Confirm new password</label>
        <input id="confirm" name="confirm" type="password" minLength={8} required autoComplete="new-password" className="input" />
      </div>
      <Status state={state} />
      <Submit pending={pending}>Save new password</Submit>
    </form>
  );
}
