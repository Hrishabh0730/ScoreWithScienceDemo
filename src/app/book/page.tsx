import type { Metadata } from "next";
import Link from "next/link";
import { PageHero } from "@/components/ui";
import { getSettings } from "@/lib/data";
import { inr } from "@/lib/format";

export const metadata: Metadata = { title: "Book a class", alternates: { canonical: "/book" } };
export const revalidate = 60;

export default async function BookPage() {
  const { pricing } = await getSettings();
  const options = [
    {
      href: "/tuition#book",
      title: "Chemistry tuition",
      price: `${inr(pricing.tuition_per_hour * 100)} / hour`,
      text: "A planned one-to-one lesson on a chapter or topic.",
    },
    {
      href: "/doubts#book",
      title: "Doubt session",
      price: `${inr(pricing.doubt_30 * 100)} / 30 min · ${inr(pricing.doubt_60 * 100)} / 60 min`,
      text: "Short and focused — bring the questions you're stuck on.",
    },
  ];
  return (
    <>
      <PageHero eyebrow="Book a class" title="What would you like to book?" lead="Both are online, one-to-one and for Classes 8–10 (CBSE & ICSE)." />
      <div className="container-x grid gap-6 py-12 md:grid-cols-2">
        {options.map((o) => (
          <Link key={o.href} href={o.href} className="card group p-8 transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)]">
            <h2 className="text-2xl font-extrabold text-navy-900">{o.title}</h2>
            <p className="mt-1 font-bold text-saffron-600">{o.price}</p>
            <p className="mt-3 text-muted">{o.text}</p>
            <span className="btn-primary mt-6">Choose →</span>
          </Link>
        ))}
      </div>
    </>
  );
}
