import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SimpleText } from "@/components/SimpleText";
import { PageHero } from "@/components/ui";
import { DEFAULT_POLICIES, POLICY_SLUGS, POLICY_TITLES, type PolicySlug } from "@/lib/policies";
import { createPublicClient } from "@/lib/supabase/server";

export const revalidate = 300;
export const dynamicParams = false;

export function generateStaticParams() {
  return POLICY_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const title = POLICY_TITLES[slug as PolicySlug];
  return title ? { title, alternates: { canonical: `/policies/${slug}` } } : {};
}

export default async function PolicyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!POLICY_SLUGS.includes(slug as PolicySlug)) notFound();
  const s = slug as PolicySlug;
  let text = DEFAULT_POLICIES[s];
  let updated: string | null = null;
  const sb = createPublicClient();
  if (sb) {
    const { data } = await sb.from("site_settings").select("value, updated_at").eq("key", `policy_${s}`).maybeSingle();
    if (data?.value?.text) {
      text = String(data.value.text);
      updated = data.updated_at;
    }
  }
  return (
    <>
      <PageHero eyebrow="Policies" title={POLICY_TITLES[s]} lead={updated ? `Last updated ${new Date(updated).toLocaleDateString("en-IN")}` : undefined} />
      <article className="container-x max-w-3xl py-10">
        <SimpleText text={text} />
      </article>
    </>
  );
}
