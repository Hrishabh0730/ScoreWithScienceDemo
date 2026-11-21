import { SUPABASE_URL } from "@/lib/config";

/** Public URL of an image in the public "note-images" bucket. */
export function imageUrl(path: string | null | undefined): string | null {
  if (!path || !SUPABASE_URL) return null;
  return `${SUPABASE_URL}/storage/v1/object/public/note-images/${path.split("/").map(encodeURIComponent).join("/")}`;
}
