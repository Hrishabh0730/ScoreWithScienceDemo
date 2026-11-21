import type { Metadata } from "next";
import { AuthShell } from "../AuthShell";
import { LoginForm } from "../AuthForms";
import { safeNext } from "@/lib/safe-next";

export const metadata: Metadata = { title: "Log in", robots: { index: false } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeNext((await searchParams).next);
  return (
    <AuthShell title="Welcome back" lead="Log in to download your notes and manage your classes.">
      <LoginForm next={next} />
    </AuthShell>
  );
}
