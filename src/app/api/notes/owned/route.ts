import { json } from "@/lib/api";
import { getSession } from "@/lib/auth";

export async function GET() {
  const { user, supabase } = await getSession();
  if (!user || !supabase) return json({ owned: [], loggedIn: false });
  const { data } = await supabase.from("order_items").select("note_id, orders!inner(status)").eq("orders.status", "paid");
  return json({ owned: [...new Set((data ?? []).map((r) => r.note_id))], loggedIn: true });
}
