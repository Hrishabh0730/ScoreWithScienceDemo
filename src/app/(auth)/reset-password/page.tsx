import type { Metadata } from "next";
import { AuthShell } from "../AuthShell";
import { ResetForm } from "../AuthForms";

export const metadata: Metadata = { title: "Set new password", robots: { index: false } };

export default function ResetPage() {
  return (
    <AuthShell title="Set a new password">
      <ResetForm />
    </AuthShell>
  );
}
