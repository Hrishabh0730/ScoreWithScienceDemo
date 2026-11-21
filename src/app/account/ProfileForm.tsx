"use client";
import { useActionState } from "react";
import { Notice } from "@/components/ui";
import { updateProfile } from "./actions";

export function ProfileForm({ profile }: { profile: { full_name: string; phone: string; class_level: number | null; board: string | null } }) {
  const [state, action, pending] = useActionState(updateProfile, undefined);
  return (
    <form action={action} className="grid gap-3">
      <div>
        <label className="label" htmlFor="pf-name">Name</label>
        <input id="pf-name" name="full_name" defaultValue={profile.full_name} required maxLength={100} className="input" />
      </div>
      <div>
        <label className="label" htmlFor="pf-phone">Phone (optional)</label>
        <input id="pf-phone" name="phone" defaultValue={profile.phone} maxLength={16} className="input" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="pf-class">Class</label>
          <select id="pf-class" name="class_level" defaultValue={profile.class_level ?? ""} className="input">
            <option value="">—</option>
            {[8, 9, 10].map((c) => <option key={c} value={c}>Class {c}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="pf-board">Board</label>
          <select id="pf-board" name="board" defaultValue={profile.board ?? ""} className="input">
            <option value="">—</option>
            <option>CBSE</option>
            <option>ICSE</option>
          </select>
        </div>
      </div>
      {state?.error && <Notice tone="error">{state.error}</Notice>}
      {state?.ok && <Notice tone="success">{state.ok}</Notice>}
      <button className="btn-outline" disabled={pending}>{pending ? "Saving…" : "Save profile"}</button>
    </form>
  );
}
