"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { SITE_URL, isSupabaseConfigured } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/safe-next";

export type FormState = { error?: string; ok?: string } | undefined;

function notConfigured(): FormState {
  return { error: "Accounts aren't switched on yet (Supabase is not configured)." };
}

export async function login(_: FormState, fd: FormData): Promise<FormState> {
  if (!isSupabaseConfigured) return notConfigured();
  const email = String(fd.get("email") || "").trim();
  const password = String(fd.get("password") || "");
  if (!email || !password) return { error: "Enter your email and password." };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    if (/confirm/i.test(error.message)) return { error: "Please confirm your email first — check your inbox for the link." };
    return { error: "Email or password is incorrect." };
  }
  redirect(safeNext(fd.get("next")));
}

const Register = z.object({
  full_name: z.string().trim().min(2, "Enter the student's name").max(100),
  email: z.string().trim().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters").max(72),
  phone: z
    .string()
    .trim()
    .max(16)
    .regex(/^[0-9+ -]*$/, "Phone can contain only digits, spaces, + and -")
    .optional(),
  class_level: z.enum(["8", "9", "10"], { message: "Choose a class" }),
  board: z.enum(["CBSE", "ICSE"], { message: "Choose a board" }),
  guardian_consent: z.literal("on", { message: "Please confirm parent/guardian permission" }),
  terms: z.literal("on", { message: "Please accept the terms and privacy policy" }),
});

export async function register(_: FormState, fd: FormData): Promise<FormState> {
  if (!isSupabaseConfigured) return notConfigured();
  const parsed = Register.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Please check the form." };
  const d = parsed.data;
  const next = safeNext(fd.get("next"));
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: d.email,
    password: d.password,
    options: {
      emailRedirectTo: `${SITE_URL}/auth/confirm?next=${encodeURIComponent(next)}`,
      data: {
        full_name: d.full_name,
        phone: d.phone || null,
        class_level: d.class_level,
        board: d.board,
        guardian_consent: true,
      },
    },
  });
  if (error) {
    if (/already/i.test(error.message)) return { error: "An account with this email already exists. Try logging in." };
    if (/password/i.test(error.message)) return { error: error.message };
    return { error: "Could not create the account. Please try again." };
  }
  if (data.session) redirect(next);
  return { ok: "Almost done! We've emailed you a confirmation link. Open it to activate your account." };
}

export async function forgotPassword(_: FormState, fd: FormData): Promise<FormState> {
  if (!isSupabaseConfigured) return notConfigured();
  const email = String(fd.get("email") || "").trim();
  if (!email.includes("@")) return { error: "Enter a valid email." };
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${SITE_URL}/auth/confirm?next=/reset-password` });
  // Same message either way, so nobody can test which emails have accounts.
  return { ok: "If an account exists for that email, a reset link is on its way." };
}

export async function resetPassword(_: FormState, fd: FormData): Promise<FormState> {
  if (!isSupabaseConfigured) return notConfigured();
  const password = String(fd.get("password") || "");
  if (password.length < 8) return { error: "Password must be at least 8 characters." };
  if (password !== String(fd.get("confirm") || "")) return { error: "Passwords don't match." };
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { error: "Your reset link has expired. Please request a new one." };
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.message };
  redirect("/account?pw=1");
}

export async function logout() {
  if (isSupabaseConfigured) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  redirect("/");
}
