import type { Metadata } from "next";
import { AuthShell } from "../AuthShell";
import { RegisterForm } from "../AuthForms";
import { safeNext } from "@/lib/safe-next";

export const metadata: Metadata = { title: "Create account", robots: { index: false } };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeNext((await searchParams).next);
  return (
    <AuthShell title="Create your free account" lead="Takes less than a minute. We only ask for what we need.">
      <RegisterForm next={next} />
    </AuthShell>
  );
}
