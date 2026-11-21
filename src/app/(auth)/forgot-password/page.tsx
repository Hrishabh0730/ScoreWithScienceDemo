import type { Metadata } from "next";
import { AuthShell } from "../AuthShell";
import { ForgotForm } from "../AuthForms";

export const metadata: Metadata = { title: "Reset password", robots: { index: false } };

export default function ForgotPage() {
  return (
    <AuthShell title="Forgot your password?" lead="Enter your email and we'll send you a link to set a new one.">
      <ForgotForm />
    </AuthShell>
  );
}
