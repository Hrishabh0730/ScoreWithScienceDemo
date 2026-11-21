"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";

const P = z.object({
  full_name: z.string().trim().min(2).max(100),
  phone: z.string().trim().max(16).regex(/^[0-9+ -]*$/),
  class_level: z.enum(["", "8", "9", "10"]),
  board: z.enum(["", "CBSE", "ICSE"]),
});

export async function updateProfile(_: unknown, fd: FormData): Promise<{ ok?: string; error?: string }> {
  const { supabase, user } = await requireUser();
  const parsed = P.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: "Please check your details (phone: digits only)." };
  const d = parsed.data;
  if (d.phone && d.phone.replace(/\D/g, "").length < 7) return { error: "Phone number looks too short." };
  // Column privileges in the database only allow these four fields to change.
  const { error } = await supabase
    .from("profiles")
    .update({ full_name: d.full_name, phone: d.phone || null, class_level: d.class_level ? Number(d.class_level) : null, board: d.board || null })
    .eq("id", user.id);
  if (error) return { error: "Could not save. Please try again." };
  revalidatePath("/account");
  return { ok: "Saved." };
}
