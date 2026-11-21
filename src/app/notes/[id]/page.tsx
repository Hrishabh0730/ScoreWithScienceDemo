import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AddToCart } from "@/components/AddToCart";
import { NoteCover } from "@/components/ui";
import { getNote, imageUrl } from "@/lib/data";
import { inr } from "@/lib/format";

export const revalidate = 60;

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const note = await getNote((await params).id);
  if (!note) return { title: "Notes not found" };
  return {
    title: `${note.title} — Class ${note.class_level} ${note.board} ${note.subject} notes`,
    description: note.description || `Handwritten notes for ${note.title}, Class ${note.class_level} ${note.board}.`,
    alternates: { canonical: `/notes/${note.id}` },
  };
}

export default async function NotePage({ params }: { params: Promise<{ id: string }> }) {
  const note = await getNote((await params).id);
  if (!note) notFound();
  const previews = note.preview_paths.map(imageUrl).filter(Boolean) as string[];
  const label = `Class ${note.class_level} · ${note.board} · ${note.subject}`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: `${note.title} – handwritten notes (${label})`,
    description: note.description,
    brand: { "@type": "Brand", name: "ScoreWithScience" },
    offers: {
      "@type": "Offer",
      priceCurrency: "INR",
      price: (note.price_paise / 100).toFixed(2),
      availability: note.is_available ? "https://schema.org/InStock" : "https://schema.org/PreOrder",
    },
  };

  return (
    <div className="container-x py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <nav aria-label="Breadcrumb" className="text-sm text-muted">
        <Link href="/notes" className="hover:underline">Notes</Link> <span aria-hidden>/</span> Class {note.class_level} {note.board}
      </nav>
      <div className="mt-6 grid gap-10 lg:grid-cols-[1fr_1fr]">
        <div>
          <NoteCover note={note} className="aspect-[4/3] rounded-[var(--radius-card)] border border-line" />
          {previews.length > 0 && (
            <section className="mt-6" aria-labelledby="preview-h">
              <h2 id="preview-h" className="font-bold text-navy-900">Sample pages</h2>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {previews.map((src, i) => (
                  <a key={src} href={src} target="_blank" rel="noopener noreferrer" className="relative block aspect-[3/4] overflow-hidden rounded-xl border border-line bg-white">
                    <Image src={src} alt={`Sample page ${i + 1} of ${note.title}`} fill sizes="200px" className="object-cover" />
                  </a>
                ))}
              </div>
            </section>
          )}
        </div>
        <div>
          <p className="eyebrow">{label}</p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-navy-900 sm:text-4xl">
            {note.chapter_no ? `Chapter ${note.chapter_no}: ` : ""}
            {note.title}
          </h1>
          <p className="mt-4 whitespace-pre-line leading-relaxed text-muted">{note.description}</p>
          <dl className="mt-6 grid grid-cols-2 gap-3 text-sm">
            <Info k="Format" v="PDF (handwritten)" />
            <Info k="Pages" v={note.pages ? String(note.pages) : "—"} />
            <Info k="Access" v="Download any time from your account" />
            <Info k="Status" v={note.is_available ? "Available now" : "Coming soon"} />
          </dl>
          <div className="card mt-8 flex flex-wrap items-center justify-between gap-4 p-5">
            <div>
              <p className="text-sm text-muted">Price</p>
              <p className="text-3xl font-extrabold text-navy-900">{inr(note.price_paise)}</p>
            </div>
            {note.is_available ? (
              <AddToCart item={{ id: note.id, title: note.title, label, price_paise: note.price_paise }} />
            ) : (
              <span className="chip bg-slate-100 px-4 py-2 text-sm text-slate-700">Not yet available</span>
            )}
          </div>
          <p className="mt-4 text-xs text-muted">
            Digital product for personal study only. Each download is marked with your order number. See the{" "}
            <Link href="/policies/notes" className="underline">notes purchase policy</Link>.
          </p>
        </div>
      </div>
    </div>
  );
}

function Info({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-xl bg-navy-50/70 p-3">
      <dt className="text-xs font-bold uppercase tracking-wide text-muted">{k}</dt>
      <dd className="mt-0.5 font-semibold text-navy-900">{v}</dd>
    </div>
  );
}
