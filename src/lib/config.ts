// Central place for environment configuration. Secrets are read only on the server.

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
// Supabase's newer "publishable" key and the legacy "anon" key both work.
export const SUPABASE_PUBLIC_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export const RAZORPAY_KEY_ID = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "";

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_PUBLIC_KEY);

export function serverSecrets() {
  return {
    supabaseServiceKey: process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "",
    razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET || "",
    razorpayWebhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || "",
    resendApiKey: process.env.RESEND_API_KEY || "",
    emailFrom: process.env.EMAIL_FROM || "",
  };
}

/** Payments work only with Razorpay keys set. Live keys need an explicit opt-in. */
export function paymentsStatus(): { ok: boolean; mode: "test" | "live" | "off"; reason?: string } {
  const { razorpayKeySecret } = serverSecrets();
  if (!RAZORPAY_KEY_ID || !razorpayKeySecret) return { ok: false, mode: "off", reason: "Razorpay keys are not configured yet." };
  if (RAZORPAY_KEY_ID.startsWith("rzp_live_")) {
    if (process.env.ALLOW_LIVE_PAYMENTS !== "true") {
      return { ok: false, mode: "live", reason: "Live Razorpay keys detected but ALLOW_LIVE_PAYMENTS is not 'true'." };
    }
    return { ok: true, mode: "live" };
  }
  return { ok: true, mode: "test" };
}
