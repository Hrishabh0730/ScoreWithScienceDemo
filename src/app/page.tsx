import Image from "next/image";
import Link from "next/link";
import { ContactForm } from "@/components/ContactForm";
import { AtomArt, FaqList, NoteCard, SectionHead, VideoGrid } from "@/components/ui";
import { getFaqs, getPublishedNotes, getSettings, getTestimonials, getVideos } from "@/lib/data";
import { inr } from "@/lib/format";

export const revalidate = 60;

export default async function Home() {
  const [{ site, pricing }, notes, videos, faqs, testimonials] = await Promise.all([
    getSettings(),
    getPublishedNotes(),
    getVideos(6),
    getFaqs(),
    getTestimonials(),
  ]);
  const featured = [...notes].sort((a, b) => Number(b.is_available) - Number(a.is_available)).slice(0, 3);
  const availableCount = notes.filter((n) => n.is_available).length;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "EducationalOrganization",
    name: "ScoreWithScience",
    slogan: site.tagline,
    description: site.hero_subtitle,
    sameAs: [site.youtube_channel_url, site.instagram_url, site.facebook_url, site.x_url].filter(Boolean),
    areaServed: "IN",
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="grid-paper absolute inset-0 [mask-image:linear-gradient(to_bottom,black,transparent)]" aria-hidden />
        <div className="container-x relative grid items-center gap-12 pb-16 pt-10 sm:pt-16 lg:grid-cols-[1.15fr_0.85fr] lg:pb-24">
          <div>
            <p className="rise inline-flex items-center gap-2 rounded-full border border-line bg-white px-3 py-1.5 text-xs font-bold text-navy-800 shadow-xs">
              <span className="h-2 w-2 rounded-full bg-teal-500" /> Classes 8 · 9 · 10 — CBSE &amp; ICSE
            </p>
            <h1 className="h-display rise rise-2 mt-5">
              {site.hero_title.split(" ").slice(0, -2).join(" ")}{" "}
              <span className="relative whitespace-nowrap text-saffron-500">
                {site.hero_title.split(" ").slice(-2).join(" ")}
                <svg className="absolute -bottom-2 left-0 h-3 w-full text-saffron-400/60" viewBox="0 0 200 12" preserveAspectRatio="none" aria-hidden>
                  <path d="M2 9c40-6 120-8 196-3" stroke="currentColor" strokeWidth="4" fill="none" strokeLinecap="round" />
                </svg>
              </span>
            </h1>
            <p className="font-hand rise rise-2 mt-4 text-2xl text-navy-600">{site.tagline}</p>
            <p className="lead rise rise-3 mt-4 max-w-xl">{site.hero_subtitle}</p>
            <div className="rise rise-3 mt-8 flex flex-wrap gap-3">
              <Link href="/notes" className="btn-accent">Explore Notes</Link>
              <Link href="/book" className="btn-primary">Book a Class</Link>
              <Link href="/tuition" className="btn-outline">Explore Chemistry Classes</Link>
            </div>
            <dl className="rise rise-3 mt-10 grid max-w-md grid-cols-3 gap-4">
              <Stat k={`${inr(pricing.note_default * 100)}`} v="per chapter of notes" />
              <Stat k={`${inr(pricing.tuition_per_hour * 100)}`} v="per hour, 1-on-1" />
              <Stat k={`${inr(pricing.doubt_30 * 100)}`} v="30-min doubt session" />
            </dl>
          </div>
          <div className="relative mx-auto w-full max-w-sm lg:max-w-none">
            <AtomArt className="absolute -right-10 -top-10 h-72 w-72 text-navy-600/15" />
            <div className="relative rotate-[-2deg] rounded-[1.75rem] border border-line bg-white p-6 shadow-[var(--shadow-lift)]">
              <div className="flex items-center gap-3">
                <Image src="/logo.png" alt="ScoreWithScience logo" width={64} height={64} className="rounded-full" priority />
                <div>
                  <p className="text-sm font-bold text-navy-900">Today&apos;s note</p>
                  <p className="text-xs text-muted">Chemical Reactions · Class 10</p>
                </div>
              </div>
              <div className="mt-5 rounded-2xl bg-[#fffdf7] p-5 [background-image:repeating-linear-gradient(to_bottom,transparent_0,transparent_29px,rgb(55_102_166/.15)_30px)]">
                <p className="font-hand text-[26px] leading-[30px] text-navy-900">
                  Zn + CuSO<sub>4</sub> → ZnSO<sub>4</sub> + Cu
                </p>
                <p className="font-hand text-[22px] leading-[30px] text-saffron-600">↳ displacement reaction!</p>
                <p className="font-hand text-[22px] leading-[30px] text-navy-700">Zn is more reactive than Cu ✓</p>
                <p className="font-hand text-[22px] leading-[30px] text-teal-700">Blue solution → colourless</p>
              </div>
            </div>
            <div className="absolute -bottom-5 -left-3 rotate-[3deg] rounded-2xl bg-navy-800 px-4 py-3 text-white shadow-[var(--shadow-lift)]">
              <p className="text-xs text-navy-100">1-on-1 online doubt sessions</p>
              <p className="font-bold">Book in under a minute</p>
            </div>
          </div>
        </div>
      </section>

      {/* INTRO + CLASSES */}
      <section className="border-y border-line bg-white">
        <div className="container-x grid gap-10 py-14 md:grid-cols-2 md:items-center">
          <div>
            <p className="eyebrow">Why ScoreWithScience</p>
            <h2 className="h-section mt-2">Understand first. Marks follow.</h2>
            <p className="lead mt-4">{site.about}</p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[8, 9, 10].map((c) => (
              <Link key={c} href={`/notes?class=${c}`} className="card group p-5 text-center transition hover:-translate-y-0.5 hover:border-navy-600/30">
                <p className="text-xs font-bold uppercase tracking-wider text-muted">Class</p>
                <p className="text-4xl font-extrabold text-navy-900 group-hover:text-saffron-500">{c}</p>
                <p className="mt-1 text-xs font-semibold text-teal-700">CBSE · ICSE</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* NOTES */}
      <section className="container-x py-20">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <SectionHead
            eyebrow="Handwritten notes"
            title="Chapter-wise notes you'll actually read"
            lead={`Neat, handwritten, exam-focused notes for every chapter — just ${inr(pricing.note_default * 100)} a chapter. Buy only what you need and download instantly.`}
          />
          <Link href="/notes" className="btn-outline">
            Browse all notes {availableCount > 0 && <span className="chip bg-teal-50 text-teal-700">{availableCount} available</span>}
          </Link>
        </div>
        {featured.length > 0 ? (
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((n) => (
              <NoteCard key={n.id} note={n} />
            ))}
          </div>
        ) : (
          <p className="mt-8 text-muted">New chapters are being added. Check back soon!</p>
        )}
      </section>

      {/* TUITION + DOUBTS */}
      <section className="bg-navy-900 text-white">
        <div className="container-x grid gap-6 py-20 lg:grid-cols-2">
          <ServiceCard
            id="tuition"
            eyebrow="Chemistry tuition"
            title="One-to-one Chemistry classes"
            price={`${inr(pricing.tuition_per_hour * 100)} / hour`}
            points={["Online, one student at a time", "Class 8, 9 & 10 — CBSE & ICSE", "Pick a slot that suits you", "Pay securely, get instant confirmation"]}
            href="/tuition"
            cta="Book tuition"
          />
          <ServiceCard
            id="doubts"
            eyebrow="Doubt solving"
            title="Stuck on a question? Clear it fast."
            price={`${inr(pricing.doubt_30 * 100)} / 30 min · ${inr(pricing.doubt_60 * 100)} / 60 min`}
            points={["Bring any Chemistry doubt", "Short, focused online sessions", "Great before tests & exams", "Only real, open slots are shown"]}
            href="/doubts"
            cta="Book a doubt session"
            accent
          />
        </div>
      </section>

      {/* VIDEOS */}
      <section className="container-x py-20">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <SectionHead eyebrow="On YouTube" title="Free lessons on our channel" lead="Short, clear explanations of key Chemistry concepts — watch, then grab the notes." />
          {site.youtube_channel_url && (
            <a href={site.youtube_channel_url} target="_blank" rel="noopener noreferrer" className="btn-primary">
              Visit YouTube channel
            </a>
          )}
        </div>
        <div className="mt-10">
          {videos.length > 0 ? (
            <VideoGrid videos={videos} />
          ) : (
            <div className="card flex flex-col items-center gap-3 p-10 text-center">
              <p className="font-bold text-navy-900">Videos will appear here soon.</p>
              <p className="text-sm text-muted">Meanwhile, catch the latest lessons on our YouTube channel.</p>
            </div>
          )}
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="border-y border-line bg-white">
        <div className="container-x py-20">
          <SectionHead eyebrow="Student voices" title="What students say" center />
          {testimonials.length > 0 ? (
            <div className="mt-10 grid gap-6 md:grid-cols-3">
              {testimonials.map((t) => (
                <figure key={t.id} className="card p-6">
                  <blockquote className="leading-relaxed text-ink">“{t.quote}”</blockquote>
                  <figcaption className="mt-4 text-sm font-bold text-navy-900">
                    {t.author_name}
                    {t.author_detail && <span className="block font-medium text-muted">{t.author_detail}</span>}
                  </figcaption>
                </figure>
              ))}
            </div>
          ) : (
            <div className="mt-10 grid gap-6 md:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="rounded-[var(--radius-card)] border-2 border-dashed border-line p-6 text-center">
                  <p className="font-hand text-2xl text-navy-600">Your review here</p>
                  <p className="mt-2 text-sm text-muted">Reviews from real students will appear here once they share them.</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="container-x scroll-mt-20 py-20">
        <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
          <SectionHead eyebrow="FAQ" title="Questions parents and students ask" lead="Can't find your answer? Send us a message below." />
          {faqs.length > 0 ? <FaqList faqs={faqs} /> : <p className="text-muted">FAQs coming soon.</p>}
        </div>
      </section>

      {/* CONTACT */}
      <section id="contact" className="container-x scroll-mt-20">
        <div className="grid gap-10 rounded-[2rem] bg-saffron-50 p-6 sm:p-10 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <p className="eyebrow !text-saffron-600">Contact</p>
            <h2 className="h-section mt-2">Talk to us</h2>
            <p className="lead mt-3">Questions about notes, classes or payments? We&apos;re happy to help.</p>
            <ul className="mt-6 space-y-2 text-sm font-semibold text-navy-900">
              {site.contact_email && <li>✉️ <a className="underline-offset-4 hover:underline" href={`mailto:${site.contact_email}`}>{site.contact_email}</a></li>}
              {site.whatsapp_number && <li>💬 WhatsApp: {site.whatsapp_number}</li>}
            </ul>
          </div>
          <ContactForm />
        </div>
      </section>
    </>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="sr-only">{v}</dt>
      <dd className="text-2xl font-extrabold text-navy-900">{k}</dd>
      <dd className="text-xs font-medium leading-snug text-muted">{v}</dd>
    </div>
  );
}

function ServiceCard(p: { id: string; eyebrow: string; title: string; price: string; points: string[]; href: string; cta: string; accent?: boolean }) {
  return (
    <div id={p.id} className="relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-8">
      <AtomArt className={`absolute -right-12 -top-12 h-48 w-48 ${p.accent ? "text-saffron-400/20" : "text-teal-500/20"}`} />
      <p className={`text-xs font-bold uppercase tracking-[0.16em] ${p.accent ? "text-saffron-400" : "text-teal-500"}`}>{p.eyebrow}</p>
      <h2 className="mt-2 text-2xl font-extrabold sm:text-3xl">{p.title}</h2>
      <p className="mt-3 text-lg font-bold text-white">{p.price}</p>
      <ul className="mt-5 space-y-2.5 text-navy-100">
        {p.points.map((x) => (
          <li key={x} className="flex gap-2.5">
            <span className={p.accent ? "text-saffron-400" : "text-teal-500"}>✓</span>
            {x}
          </li>
        ))}
      </ul>
      <Link href={p.href} className={`${p.accent ? "btn-accent" : "btn bg-white text-navy-900 hover:bg-navy-50"} mt-8`}>
        {p.cta}
      </Link>
    </div>
  );
}
