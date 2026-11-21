import "server-only";
import { serverSecrets } from "@/lib/config";

/**
 * Optional transactional email via Resend's HTTP API.
 * If RESEND_API_KEY / EMAIL_FROM are not set, this silently does nothing —
 * confirmations are still shown on screen and in the student's account.
 */
export async function sendEmail(to: string, subject: string, html: string) {
  const { resendApiKey, emailFrom } = serverSecrets();
  if (!resendApiKey || !emailFrom) return { sent: false as const };
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${resendApiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: emailFrom, to: [to], subject, html }),
  });
  return { sent: res.ok };
}
