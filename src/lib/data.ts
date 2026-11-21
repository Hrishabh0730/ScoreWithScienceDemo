import "server-only";
import { cache } from "react";
import { createPublicClient } from "@/lib/supabase/server";
import type { BookingSettings, Faq, Note, PricingSettings, SiteSettings, Testimonial, Video } from "@/lib/types";

export const DEFAULT_SITE: SiteSettings = {
  tagline: "Understand Science. Improve Your Score.",
  hero_title: "Science that finally makes sense.",
  hero_subtitle:
    "Handwritten notes, one-to-one Chemistry tuition and quick doubt-solving for Classes 8, 9 and 10 — CBSE and ICSE.",
  about:
    "ScoreWithScience helps students understand Science properly, not just memorise it. Clear handwritten notes, patient one-to-one Chemistry classes and fast doubt-solving — all at prices that work for Indian families.",
  contact_email: "",
  whatsapp_number: "",
  youtube_channel_url: "https://www.youtube.com/@ScoreWithScience",
  instagram_url: "",
  facebook_url: "",
  x_url: "",
  telegram_url: "",
  business_name: "ScoreWithScience",
  business_address: "",
  ga_measurement_id: "",
  google_site_verification: "",
};

export const DEFAULT_PRICING: PricingSettings = { note_default: 10, tuition_per_hour: 100, doubt_30: 50, doubt_60: 100 };
export const DEFAULT_BOOKING: BookingSettings = { bookings_open: true, hold_minutes: 10, min_notice_hours: 2, max_days_ahead: 60 };

export const getSettings = cache(async () => {
  const sb = createPublicClient();
  let rows: { key: string; value: Record<string, unknown> }[] = [];
  if (sb) {
    const { data } = await sb.from("site_settings").select("key, value");
    rows = data ?? [];
  }
  const get = (k: string) => (rows.find((r) => r.key === k)?.value ?? {}) as Record<string, unknown>;
  return {
    site: { ...DEFAULT_SITE, ...get("site") } as SiteSettings,
    pricing: { ...DEFAULT_PRICING, ...get("pricing") } as PricingSettings,
    booking: { ...DEFAULT_BOOKING, ...get("booking") } as BookingSettings,
  };
});

export const getFaqs = cache(async (): Promise<Faq[]> => {
  const sb = createPublicClient();
  if (!sb) return [];
  const { data } = await sb.from("faqs").select("*").eq("is_published", true).order("sort_order");
  return data ?? [];
});

export const getTestimonials = cache(async (): Promise<Testimonial[]> => {
  const sb = createPublicClient();
  if (!sb) return [];
  const { data } = await sb.from("testimonials").select("*").eq("is_published", true).order("sort_order");
  return data ?? [];
});

export const getVideos = cache(async (limit = 50): Promise<Video[]> => {
  const sb = createPublicClient();
  if (!sb) return [];
  const { data } = await sb
    .from("videos")
    .select("*")
    .eq("is_published", true)
    .order("sort_order")
    .order("created_at", { ascending: false })
    .limit(limit);
  return data ?? [];
});

const NOTE_COLUMNS =
  "id,title,chapter_no,class_level,board,subject,description,price_paise,cover_path,preview_paths,is_published,is_available,pages";

export const getPublishedNotes = cache(async (): Promise<Note[]> => {
  const sb = createPublicClient();
  if (!sb) return [];
  const { data } = await sb
    .from("notes")
    .select(NOTE_COLUMNS)
    .eq("is_published", true)
    .order("class_level")
    .order("board")
    .order("subject")
    .order("chapter_no");
  return (data as Note[]) ?? [];
});

export const getNote = cache(async (id: string): Promise<Note | null> => {
  const sb = createPublicClient();
  if (!sb || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data } = await sb.from("notes").select(NOTE_COLUMNS).eq("id", id).eq("is_published", true).maybeSingle();
  return (data as Note) ?? null;
});

export { imageUrl } from "@/lib/images";
