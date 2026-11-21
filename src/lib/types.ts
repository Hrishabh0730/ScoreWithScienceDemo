export type Board = "CBSE" | "ICSE";
export type ClassLevel = 8 | 9 | 10;
export type Service = "tuition" | "doubt";

export const CLASSES: ClassLevel[] = [8, 9, 10];
export const BOARDS: Board[] = ["CBSE", "ICSE"];
export const SUBJECTS = ["Science", "Chemistry", "Physics", "Biology"] as const;

export interface Note {
  id: string;
  title: string;
  chapter_no: number | null;
  class_level: ClassLevel;
  board: Board;
  subject: string;
  description: string;
  price_paise: number;
  cover_path: string | null;
  preview_paths: string[];
  is_published: boolean;
  is_available: boolean;
  pages: number | null;
}

export interface Video {
  id: string;
  youtube_url: string;
  title: string;
  thumbnail_url: string | null;
  class_level: number | null;
  board: string | null;
  chapter: string | null;
  is_published: boolean;
  sort_order: number;
}

export interface Faq {
  id: string;
  question: string;
  answer: string;
  is_published: boolean;
  sort_order: number;
}

export interface Testimonial {
  id: string;
  author_name: string;
  author_detail: string | null;
  quote: string;
  is_published: boolean;
  sort_order: number;
}

export interface SiteSettings {
  tagline: string;
  hero_title: string;
  hero_subtitle: string;
  about: string;
  contact_email: string;
  whatsapp_number: string;
  youtube_channel_url: string;
  instagram_url: string;
  facebook_url: string;
  x_url: string;
  telegram_url: string;
  business_name: string;
  business_address: string;
  ga_measurement_id: string;
  google_site_verification: string;
}

export interface PricingSettings {
  note_default: number;
  tuition_per_hour: number;
  doubt_30: number;
  doubt_60: number;
}

export interface BookingSettings {
  bookings_open: boolean;
  hold_minutes: number;
  min_notice_hours: number;
  max_days_ahead: number;
}

export interface AvailableSlot {
  slot_id: string;
  start_at: string;
  end_at: string;
  minutes: number;
  seats_left: number;
  price_paise: number;
}

export const BOOKING_STATUS_LABEL: Record<string, string> = {
  pending_payment: "Awaiting payment",
  released: "Payment window closed",
  expired: "Hold expired",
  confirmed: "Confirmed",
  needs_review: "Payment received – under review",
  cancelled: "Cancelled",
  refunded: "Refunded",
  completed: "Completed",
};

export const ORDER_STATUS_LABEL: Record<string, string> = {
  created: "Payment not completed",
  paid: "Paid",
  needs_review: "Under review",
  refunded: "Refunded",
  partially_refunded: "Partially refunded",
  cancelled: "Cancelled",
};
