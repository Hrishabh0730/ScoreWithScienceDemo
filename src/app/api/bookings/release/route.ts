import type { NextRequest } from "next/server";
import { z } from "zod";
import { fail, json, sameOrigin } from "@/lib/api";
import { getSession } from "@/lib/auth";

const Body = z.object({ bookingId: z.string().uuid() });

/** Student closed the payment window: release the hold so others can book. */
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return fail("Bad origin", 403);
  const { user, supabase } = await getSession();
  if (!user || !supabase) return fail("Not logged in", 401);
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("Invalid request");
  const { error } = await supabase.rpc("release_booking", { p_booking: parsed.data.bookingId });
  if (error) return fail("Could not release", 500);
  return json({ ok: true });
}
