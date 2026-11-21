import type { NextRequest } from "next/server";
import { z } from "zod";
import { fail, json, sameOrigin } from "@/lib/api";
import { createServiceClient } from "@/lib/supabase/server";

const Body = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(200),
  phone: z.string().trim().max(16).regex(/^[0-9+ -]*$/).optional().or(z.literal("")),
  message: z.string().trim().min(5).max(3000),
  website: z.string().max(0).optional().or(z.literal("")), // honeypot
});

// Very small in-memory throttle (per server instance). Good enough against casual spam.
const hits = new Map<string, number[]>();

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return fail("Bad origin", 403);
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < 10 * 60_000);
  if (recent.length >= 5) return fail("Too many messages. Please try again later.", 429);
  hits.set(ip, [...recent, now]);

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("Please fill in your name, a valid email and a message.");
  if (parsed.data.website) return json({ ok: true }); // bot
  const { name, email, phone, message } = parsed.data;
  try {
    const db = createServiceClient();
    const { error } = await db.from("contact_messages").insert({ name, email, phone: phone || null, message });
    if (error) throw error;
  } catch {
    return fail("Messaging isn't set up yet. Please try again later.", 503);
  }
  return json({ ok: true });
}
