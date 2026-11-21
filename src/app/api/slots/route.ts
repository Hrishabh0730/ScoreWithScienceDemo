import type { NextRequest } from "next/server";
import { fail, json } from "@/lib/api";
import { createPublicClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const service = req.nextUrl.searchParams.get("service");
  if (service !== "tuition" && service !== "doubt") return fail("Invalid service");
  const sb = createPublicClient();
  if (!sb) return json({ slots: [], configured: false });
  const { data, error } = await sb.rpc("available_slots", { p_service: service, p_minutes: null });
  if (error) return fail("Could not load slots", 500);
  return json({ slots: data ?? [], configured: true });
}
