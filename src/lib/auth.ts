import "server-only";
import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";

export interface Profile {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  class_level: number | null;
  board: string | null;
  role: "student" | "admin";
  guardian_consent: boolean;
  created_at: string;
}

/** Current user + profile, verified with Supabase Auth (not just the cookie). */
export async function getSession() {
  if (!isSupabaseConfigured) return { supabase: null, user: null, profile: null } as const;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, profile: null } as const;
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  return { supabase, user, profile: (profile as Profile) ?? null } as const;
}

export async function requireUser(next = "/account") {
  const s = await getSession();
  if (!s.user || !s.supabase) redirect(`/login?next=${encodeURIComponent(next)}`);
  return { supabase: s.supabase, user: s.user, profile: s.profile };
}

export async function requireAdmin() {
  const s = await getSession();
  if (!s.user || !s.supabase) redirect("/login?next=/admin");
  if (s.profile?.role !== "admin") redirect("/account?denied=1");
  return { supabase: s.supabase, user: s.user, profile: s.profile };
}

/** For server actions: throws instead of redirecting. */
export async function assertAdmin() {
  const s = await getSession();
  if (!s.user || !s.supabase || s.profile?.role !== "admin") throw new Error("Not authorised");
  return { supabase: s.supabase, user: s.user, profile: s.profile };
}
