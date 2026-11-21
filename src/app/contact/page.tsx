import type { Metadata } from "next";
import { ContactForm } from "@/components/ContactForm";
import { PageHero } from "@/components/ui";
import { getSettings } from "@/lib/data";

export const metadata: Metadata = { title: "Contact", alternates: { canonical: "/contact" } };
export const revalidate = 60;

export default async function ContactPage() {
  const { site } = await getSettings();
  const wa = site.whatsapp_number.replace(/\D/g, "");
  return (
    <>
      <PageHero eyebrow="Contact" title="We're here to help" lead="Questions about notes, classes, payments or anything else — send a message." />
      <div className="container-x grid gap-10 py-12 lg:grid-cols-[0.8fr_1.2fr]">
        <div className="space-y-4">
          {site.contact_email && (
            <a href={`mailto:${site.contact_email}`} className="card block p-5 hover:border-navy-600/30">
              <p className="text-sm text-muted">Email</p>
              <p className="font-bold text-navy-900">{site.contact_email}</p>
            </a>
          )}
          {wa.length >= 10 && (
            <a href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer" className="card block p-5 hover:border-navy-600/30">
              <p className="text-sm text-muted">WhatsApp</p>
              <p className="font-bold text-navy-900">{site.whatsapp_number}</p>
            </a>
          )}
          {site.business_address && (
            <div className="card p-5">
              <p className="text-sm text-muted">Address</p>
              <p className="whitespace-pre-line font-semibold text-navy-900">{site.business_address}</p>
            </div>
          )}
          <div className="card p-5 text-sm text-muted">
            Parents are welcome to contact us directly about their child&apos;s classes, account or data.
          </div>
        </div>
        <ContactForm />
      </div>
    </>
  );
}
