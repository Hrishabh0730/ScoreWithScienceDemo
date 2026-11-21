"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  ["/admin", "Overview"],
  ["/admin/availability", "Availability"],
  ["/admin/bookings", "Bookings"],
  ["/admin/orders", "Payments"],
  ["/admin/notes", "Notes"],
  ["/admin/students", "Students"],
  ["/admin/videos", "YouTube videos"],
  ["/admin/content", "Website content"],
  ["/admin/faqs", "FAQs"],
  ["/admin/testimonials", "Testimonials"],
  ["/admin/messages", "Messages"],
] as const;

export function AdminNav() {
  const path = usePathname();
  return (
    <nav aria-label="Admin" className="-mx-4 overflow-x-auto px-4 lg:mx-0 lg:px-0">
      <ul className="flex gap-1 lg:sticky lg:top-20 lg:flex-col">
        {LINKS.map(([href, label]) => {
          const active = href === "/admin" ? path === href : path.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                className={`block whitespace-nowrap rounded-xl px-3 py-2 text-sm font-semibold transition ${
                  active ? "bg-navy-800 text-white" : "text-navy-900 hover:bg-white"
                }`}
              >
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
