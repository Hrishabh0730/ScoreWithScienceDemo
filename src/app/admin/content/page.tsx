import { requireAdmin } from "@/lib/auth";
import { getSettings } from "@/lib/data";
import { DEFAULT_POLICIES, POLICY_SLUGS, POLICY_TITLES } from "@/lib/policies";
import { savePolicy, savePricing, saveSite } from "../actions";
import { AdminHeader, Field, Flash, Panel, type SP } from "../ui";

export default async function Content({ searchParams }: { searchParams: SP }) {
  const { supabase } = await requireAdmin();
  const { site, pricing } = await getSettings();
  const { data: policyRows } = await supabase.from("site_settings").select("key, value").like("key", "policy_%");
  const policy = (slug: string) => (policyRows?.find((r) => r.key === `policy_${slug}`)?.value as { text?: string } | undefined)?.text;
  const T = (name: keyof typeof site, label: string, hint?: string, placeholder?: string) => (
    <Field label={label} hint={hint}>
      <input name={name} defaultValue={site[name]} placeholder={placeholder} className="input" />
    </Field>
  );

  return (
    <>
      <AdminHeader title="Website content" lead="Text, contact details, links and prices shown on the website." />
      <Flash searchParams={searchParams} />

      <Panel title="Prices (₹)">
        <form action={savePricing} className="grid gap-4 sm:grid-cols-5 sm:items-end">
          <Field label="Default note price"><input name="note_default" type="number" min={1} defaultValue={pricing.note_default} className="input" /></Field>
          <Field label="Tuition per hour"><input name="tuition_per_hour" type="number" min={1} defaultValue={pricing.tuition_per_hour} className="input" /></Field>
          <Field label="Doubt 30 min"><input name="doubt_30" type="number" min={1} defaultValue={pricing.doubt_30} className="input" /></Field>
          <Field label="Doubt 60 min"><input name="doubt_60" type="number" min={1} defaultValue={pricing.doubt_60} className="input" /></Field>
          <button className="btn-primary">Save prices</button>
        </form>
        <p className="mt-3 text-xs text-muted">Each chapter&apos;s own price is set under Notes. The default is used for new chapters and on the home page.</p>
      </Panel>

      <form action={saveSite}>
        <Panel title="Home page text">
          <div className="grid gap-4">
            {T("tagline", "Tagline")}
            {T("hero_title", "Hero headline", "The last two words are highlighted in orange.")}
            <Field label="Hero sub-text"><textarea name="hero_subtitle" defaultValue={site.hero_subtitle} rows={2} className="input" /></Field>
            <Field label="About / introduction"><textarea name="about" defaultValue={site.about} rows={4} className="input" /></Field>
          </div>
        </Panel>
        <Panel title="Contact details & links">
          <div className="grid gap-4 sm:grid-cols-2">
            {T("business_name", "Business name")}
            {T("contact_email", "Contact email", "Shown publicly", "you@example.com")}
            {T("whatsapp_number", "WhatsApp number", "With country code, e.g. +91 98xxxxxxxx. Shows the floating WhatsApp button.", "+91 …")}
            {T("youtube_channel_url", "YouTube channel URL", undefined, "https://www.youtube.com/@…")}
            {T("instagram_url", "Instagram URL", undefined, "https://instagram.com/…")}
            {T("facebook_url", "Facebook URL", undefined, "https://facebook.com/…")}
            {T("x_url", "X (Twitter) URL", undefined, "https://x.com/…")}
            {T("telegram_url", "Telegram URL", undefined, "https://t.me/…")}
            <div className="sm:col-span-2">
              <Field label="Business address (optional, public)" hint="Razorpay may ask for contact details on your website during activation.">
                <textarea name="business_address" defaultValue={site.business_address} rows={2} className="input" />
              </Field>
            </div>
          </div>
        </Panel>
        <Panel title="Analytics & Google Search Console">
          <div className="grid gap-4 sm:grid-cols-2">
            {T("ga_measurement_id", "Google Analytics 4 measurement ID", "Optional. Looks like G-XXXXXXXXXX. Leave blank for no analytics.", "G-…")}
            {T("google_site_verification", "Search Console verification", "Paste the HTML-tag content value (or the whole <meta> tag).")}
          </div>
        </Panel>
        <button className="btn-primary mb-8">Save website content</button>
      </form>

      <Panel title="Policies" id="policies">
        <p className="mb-4 text-sm text-muted">
          Edit any policy below. Leave a box empty and save to go back to the default text. Format: blank line between paragraphs, <code>## </code> for headings, <code>- </code> for bullet points.
        </p>
        <div className="space-y-4">
          {POLICY_SLUGS.map((slug) => (
            <details key={slug} className="rounded-xl border border-line p-4">
              <summary className="cursor-pointer font-bold text-navy-900">
                {POLICY_TITLES[slug]} {policy(slug) ? <span className="chip bg-teal-50 text-teal-700">Customised</span> : <span className="chip bg-slate-100 text-slate-600">Default</span>}
              </summary>
              <form action={savePolicy} className="mt-3 grid gap-2">
                <input type="hidden" name="slug" value={slug} />
                <textarea name="text" rows={14} defaultValue={policy(slug) ?? DEFAULT_POLICIES[slug]} className="input font-mono text-xs" />
                <button className="btn-outline btn-sm justify-self-start">Save {POLICY_TITLES[slug].toLowerCase()}</button>
              </form>
            </details>
          ))}
        </div>
      </Panel>
    </>
  );
}
