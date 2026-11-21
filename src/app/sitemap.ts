import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/config";
import { getPublishedNotes } from "@/lib/data";
import { POLICY_SLUGS } from "@/lib/policies";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const notes = await getPublishedNotes();
  const pages = ["", "/notes", "/tuition", "/doubts", "/book", "/videos", "/contact"];
  return [
    ...pages.map((p) => ({ url: `${SITE_URL}${p}`, changeFrequency: "weekly" as const, priority: p === "" ? 1 : 0.8 })),
    ...notes.map((n) => ({ url: `${SITE_URL}/notes/${n.id}`, changeFrequency: "monthly" as const, priority: 0.6 })),
    ...POLICY_SLUGS.map((s) => ({ url: `${SITE_URL}/policies/${s}`, changeFrequency: "yearly" as const, priority: 0.2 })),
  ];
}
