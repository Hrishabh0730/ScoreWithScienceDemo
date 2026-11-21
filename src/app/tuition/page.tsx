import type { Metadata } from "next";
import { BookingFlow } from "@/components/BookingFlow";
import { PageHero } from "@/components/ui";
import { getSettings } from "@/lib/data";
import { inr } from "@/lib/format";

export const metadata: Metadata = {
  title: "Online Chemistry Tuition — Class 8, 9, 10 (CBSE & ICSE)",
  description: "Affordable one-to-one online Chemistry tuition for Class 8, 9 and 10, CBSE and ICSE. ₹100 per hour. Pick an open slot and pay securely.",
  alternates: { canonical: "/tuition" },
};
export const revalidate = 60;

export default async function TuitionPage() {
  const { pricing } = await getSettings();
  return (
    <>
      <PageHero
        eyebrow="Chemistry tuition"
        title="One-to-one online Chemistry classes"
        lead={`Patient, concept-first teaching for Class 8, 9 and 10 — CBSE and ICSE. Just ${inr(pricing.tuition_per_hour * 100)} per hour.`}
      />
      <div className="container-x grid gap-10 py-12 lg:grid-cols-[0.8fr_1.2fr]">
        <aside className="space-y-6">
          <Card title="Who it's for" items={["Class 8 CBSE & ICSE", "Class 9 CBSE & ICSE", "Class 10 CBSE & ICSE"]} />
          <Card
            title="How it works"
            items={[
              "Choose your class, board and an open slot",
              "Pay online (UPI, card, net banking)",
              "Get instant confirmation",
              "Join online — link appears in your account",
            ]}
          />
          <Card title="Price" items={[`${inr(pricing.tuition_per_hour * 100)} per hour`, "Longer slots are priced per hour", "No hidden fees"]} />
        </aside>
        <BookingFlow service="tuition" />
      </div>
    </>
  );
}

function Card({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="card p-6">
      <h2 className="font-bold text-navy-900">{title}</h2>
      <ul className="mt-3 space-y-2 text-sm text-ink">
        {items.map((i) => (
          <li key={i} className="flex gap-2"><span className="text-teal-600">✓</span>{i}</li>
        ))}
      </ul>
    </div>
  );
}
