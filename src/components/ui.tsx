import Image from "next/image";
import Link from "next/link";
import { imageUrl } from "@/lib/images";
import { inr, videoThumb } from "@/lib/format";
import type { Faq, Note, Video } from "@/lib/types";

export function SectionHead({ eyebrow, title, lead, center = false }: { eyebrow?: string; title: string; lead?: string; center?: boolean }) {
  return (
    <div className={center ? "mx-auto max-w-2xl text-center" : "max-w-2xl"}>
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      <h2 className="h-section mt-2">{title}</h2>
      {lead && <p className="lead mt-3">{lead}</p>}
    </div>
  );
}

export function PageHero({ eyebrow, title, lead, children }: { eyebrow?: string; title: string; lead?: string; children?: React.ReactNode }) {
  return (
    <section className="grid-paper border-b border-line">
      <div className="container-x py-12 sm:py-16">
        {eyebrow && <p className="eyebrow rise">{eyebrow}</p>}
        <h1 className="h-display rise rise-2 mt-2 !text-4xl sm:!text-5xl">{title}</h1>
        {lead && <p className="lead rise rise-3 mt-4 max-w-2xl">{lead}</p>}
        {children}
      </div>
    </section>
  );
}

export function AtomArt({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 200" className={className} aria-hidden fill="none">
      <g className="orbit" style={{ transformBox: "fill-box" }}>
        <ellipse cx="100" cy="100" rx="88" ry="32" stroke="currentColor" strokeWidth="2" opacity=".55" />
        <ellipse cx="100" cy="100" rx="88" ry="32" stroke="currentColor" strokeWidth="2" opacity=".55" transform="rotate(60 100 100)" />
        <ellipse cx="100" cy="100" rx="88" ry="32" stroke="currentColor" strokeWidth="2" opacity=".55" transform="rotate(120 100 100)" />
        <circle cx="188" cy="100" r="6" fill="currentColor" />
        <circle cx="56" cy="24" r="6" fill="currentColor" />
        <circle cx="56" cy="176" r="6" fill="currentColor" />
      </g>
      <circle cx="100" cy="100" r="12" fill="currentColor" />
    </svg>
  );
}

export function NoteCover({ note, className = "" }: { note: Pick<Note, "cover_path" | "title" | "class_level" | "board" | "chapter_no">; className?: string }) {
  const src = imageUrl(note.cover_path);
  if (src) {
    return (
      <div className={`relative overflow-hidden bg-navy-50 ${className}`}>
        <Image src={src} alt={`Cover of ${note.title} notes`} fill sizes="(max-width: 640px) 100vw, 33vw" className="object-cover" />
      </div>
    );
  }
  // Generated "notebook" cover when no image is uploaded yet
  return (
    <div className={`relative overflow-hidden bg-[#fffdf7] ${className}`} aria-hidden>
      <div className="absolute inset-0 [background-image:repeating-linear-gradient(to_bottom,transparent_0,transparent_23px,rgb(55_102_166/.18)_24px)]" />
      <div className="absolute inset-y-0 left-7 w-px bg-red-300/70" />
      <div className="relative flex h-full flex-col justify-between p-5 pl-10">
        <span className="font-hand text-lg text-navy-600">
          Class {note.class_level} · {note.board}
        </span>
        <span className="font-hand text-[26px] leading-[1.05] text-navy-900 line-clamp-3">{note.title}</span>
        <span className="font-hand text-lg text-saffron-600">{note.chapter_no ? `Chapter ${note.chapter_no}` : "Notes"}</span>
      </div>
    </div>
  );
}

export function NoteCard({ note, owned = false }: { note: Note; owned?: boolean }) {
  return (
    <article className="card group flex flex-col overflow-hidden transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)]">
      <Link href={`/notes/${note.id}`} className="block" tabIndex={-1} aria-hidden>
        <NoteCover note={note} className="aspect-[4/3]" />
      </Link>
      <div className="flex flex-1 flex-col p-5">
        <div className="flex flex-wrap gap-1.5">
          <span className="chip bg-navy-50 text-navy-800">Class {note.class_level}</span>
          <span className="chip bg-teal-50 text-teal-700">{note.board}</span>
          <span className="chip bg-saffron-50 text-saffron-600">{note.subject}</span>
        </div>
        <h3 className="mt-3 text-lg font-bold leading-snug text-navy-900">
          <Link href={`/notes/${note.id}`} className="hover:underline underline-offset-4">
            {note.chapter_no ? `Ch ${note.chapter_no}: ` : ""}
            {note.title}
          </Link>
        </h3>
        <p className="mt-1.5 line-clamp-2 text-sm text-muted">{note.description}</p>
        <div className="mt-auto flex items-center justify-between pt-4">
          <span className="text-xl font-extrabold text-navy-900">{inr(note.price_paise)}</span>
          {owned ? (
            <span className="chip bg-teal-100 text-teal-700">Owned</span>
          ) : note.is_available ? (
            <span className="chip bg-teal-50 text-teal-700">Available</span>
          ) : (
            <span className="chip bg-slate-100 text-slate-600">Coming soon</span>
          )}
        </div>
      </div>
    </article>
  );
}

export function VideoGrid({ videos }: { videos: Video[] }) {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {videos.map((v) => {
        const thumb = videoThumb(v);
        return (
          <a key={v.id} href={v.youtube_url} target="_blank" rel="noopener noreferrer" className="card group overflow-hidden transition hover:-translate-y-0.5">
            <div className="relative aspect-video bg-navy-900">
              {thumb && <Image src={thumb} alt="" fill sizes="(max-width: 640px) 100vw, 33vw" className="object-cover opacity-95 transition group-hover:opacity-100" />}
              <span className="absolute inset-0 grid place-items-center">
                <span className="grid h-12 w-12 place-items-center rounded-full bg-white/90 text-red-600 shadow-lg transition group-hover:scale-110">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </span>
              </span>
            </div>
            <div className="p-4">
              <h3 className="line-clamp-2 font-bold text-navy-900">{v.title}</h3>
              <p className="mt-1 text-xs font-semibold text-muted">
                {[v.class_level && `Class ${v.class_level}`, v.board, v.chapter].filter(Boolean).join(" · ") || "ScoreWithScience"}
              </p>
            </div>
          </a>
        );
      })}
    </div>
  );
}

export function FaqList({ faqs }: { faqs: Faq[] }) {
  return (
    <div className="divide-y divide-line rounded-[var(--radius-card)] border border-line bg-white">
      {faqs.map((f) => (
        <details key={f.id} className="group px-5 py-1 [&_summary::-webkit-details-marker]:hidden">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 font-semibold text-navy-900">
            {f.question}
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-navy-50 text-navy-800 transition group-open:rotate-45" aria-hidden>
              +
            </span>
          </summary>
          <p className="pb-5 leading-relaxed text-muted">{f.answer}</p>
        </details>
      ))}
    </div>
  );
}

export function Notice({ tone = "info", children }: { tone?: "info" | "warn" | "error" | "success"; children: React.ReactNode }) {
  const styles = {
    info: "border-navy-100 bg-navy-50 text-navy-900",
    warn: "border-amber-200 bg-amber-50 text-amber-900",
    error: "border-red-200 bg-red-50 text-red-800",
    success: "border-teal-100 bg-teal-50 text-teal-700",
  }[tone];
  return <div role={tone === "error" ? "alert" : "status"} className={`rounded-xl border px-4 py-3 text-sm ${styles}`}>{children}</div>;
}
