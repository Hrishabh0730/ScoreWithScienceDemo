"use client";
import { useFormStatus } from "react-dom";

/** Submit button that asks for confirmation first (for cancels, refunds, deletes). */
export function ConfirmButton({ message, className = "btn-outline btn-sm", children }: { message?: string; className?: string; children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button
      className={className}
      disabled={pending}
      onClick={(e) => {
        if (message && !window.confirm(message)) e.preventDefault();
      }}
    >
      {pending ? "…" : children}
    </button>
  );
}
