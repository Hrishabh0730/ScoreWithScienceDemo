import type { Metadata } from "next";
import { BookingFlow } from "@/components/BookingFlow";
import { PageHero } from "@/components/ui";
import { getSettings } from "@/lib/data";
import { inr } from "@/lib/format";

export const metadata: Metadata = {
  title: "Chemistry Doubt-Solving Sessions — 30 or 60 minutes",
  description: "Clear your Chemistry doubts one-to-one online. ₹50 for 30 minutes or ₹100 for 60 minutes. Class 8–10, CBSE & ICSE.",
  alternates: { canonical: "/doubts" },
};
export const revalidate = 60;

export default async function DoubtsPage() {
  const { pricing } = await getSettings();
  return (
    <>
      <PageHero
        eyebrow="Doubt solving"
        title="Clear your Chemistry doubts, one-to-one"
        lead={`Bring the questions you're stuck on. ${inr(pricing.doubt_30 * 100)} for 30 minutes, or ${inr(pricing.doubt_60 * 100)} for 60 minutes.`}
      />
      <div className="container-x grid gap-10 py-12 lg:grid-cols-[0.8fr_1.2fr]">
        <aside className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <PriceTile mins="30 min" price={inr(pricing.doubt_30 * 100)} />
            <PriceTile mins="60 min" price={inr(pricing.doubt_60 * 100)} />
          </div>
          <div className="card p-6">
            <h2 className="font-bold text-navy-900">Get the most out of it</h2>
            <ul className="mt-3 space-y-2 text-sm">
              <li className="flex gap-2"><span className="text-teal-600">✓</span>Write your doubt in the booking form</li>
              <li className="flex gap-2"><span className="text-teal-600">✓</span>Keep your textbook / question ready</li>
              <li className="flex gap-2"><span className="text-teal-600">✓</span>Join on time from a quiet place</li>
            </ul>
          </div>
        </aside>
        <BookingFlow service="doubt" />
      </div>
    </>
  );
}

function PriceTile({ mins, price }: { mins: string; price: string }) {
  return (
    <div className="card p-5 text-center">
      <p className="text-sm font-semibold text-muted">{mins}</p>
      <p className="text-3xl font-extrabold text-navy-900">{price}</p>
    </div>
  );
}
