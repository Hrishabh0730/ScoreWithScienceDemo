import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Handles email confirmation and password-reset links from Supabase. */
export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const rawNext = url.searchParams.get("next") || "/account";
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/account";
  const supabase = await createClient();

  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;

  let ok = false;
  if (code) ok = !(await supabase.auth.exchangeCodeForSession(code)).error;
  else if (tokenHash && type) ok = !(await supabase.auth.verifyOtp({ type, token_hash: tokenHash })).error;

  const dest = url.clone();
  dest.search = "";
  if (ok) {
    dest.pathname = type === "recovery" ? "/reset-password" : next;
  } else {
    dest.pathname = "/login";
    dest.searchParams.set("error", "link");
  }
  return NextResponse.redirect(dest);
}
