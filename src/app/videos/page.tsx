import type { Metadata } from "next";
import Link from "next/link";
import { PageHero, VideoGrid } from "@/components/ui";
import { getSettings, getVideos } from "@/lib/data";

export const metadata: Metadata = {
  title: "Free Science & Chemistry Video Lessons",
  description: "Watch ScoreWithScience video lessons for Class 8, 9 and 10 Science and Chemistry (CBSE & ICSE).",
  alternates: { canonical: "/videos" },
};

export default async function VideosPage({ searchParams }: { searchParams: Promise<{ class?: string; board?: string }> }) {
  const sp = await searchParams;
  const [{ site }, all] = await Promise.all([getSettings(), getVideos(200)]);
  const cls = Number(sp.class) || null;
  const board = sp.board === "CBSE" || sp.board === "ICSE" ? sp.board : null;
  const videos = all.filter((v) => (!cls || v.class_level === cls) && (!board || v.board === board));
  const link = (c: number | null, b: string | null) => {
    const q = new URLSearchParams();
    if (c) q.set("class", String(c));
    if (b) q.set("board", b);
    return `/videos${q.size ? `?${q}` : ""}`;
  };
  return (
    <>
      <PageHero eyebrow="YouTube" title="Video lessons" lead="Clear explanations of key concepts — free on our YouTube channel.">
        {site.youtube_channel_url && (
          <a href={site.youtube_channel_url} target="_blank" rel="noopener noreferrer" className="btn-primary mt-6">
            Subscribe on YouTube
          </a>
        )}
      </PageHero>
      <div className="container-x py-10">
        <div className="flex flex-wrap gap-2">
          {[null, 8, 9, 10].map((c) => (
            <Link key={String(c)} href={link(c, board)} className={`chip px-3.5 py-2 text-sm ${cls === c ? "bg-navy-800 text-white" : "bg-white text-navy-900 ring-1 ring-line"}`}>
              {c ? `Class ${c}` : "All classes"}
            </Link>
          ))}
          <span className="w-2" />
          {[null, "CBSE", "ICSE"].map((b) => (
            <Link key={String(b)} href={link(cls, b)} className={`chip px-3.5 py-2 text-sm ${board === b ? "bg-teal-700 text-white" : "bg-white text-navy-900 ring-1 ring-line"}`}>
              {b ?? "All boards"}
            </Link>
          ))}
        </div>
        <div className="mt-8">
          {videos.length ? <VideoGrid videos={videos} /> : <p className="text-muted">No videos here yet — check our YouTube channel for the latest lessons.</p>}
        </div>
      </div>
    </>
  );
}
