import Link from "next/link";
import { Logo } from "@/components/Logo";
import type { SiteSettings } from "@/lib/types";

export function Footer({ site }: { site: SiteSettings }) {
  const socials = [
    { label: "YouTube", href: site.youtube_channel_url },
    { label: "Instagram", href: site.instagram_url },
    { label: "Facebook", href: site.facebook_url },
    { label: "X", href: site.x_url },
    { label: "Telegram", href: site.telegram_url },
  ].filter((s) => s.href);
  return (
    <footer className="mt-24 bg-navy-950 text-navy-100">
      <div className="container-x grid gap-10 py-14 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <Logo light />
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-navy-100/70">{site.tagline}</p>
          <p className="mt-2 text-sm text-navy-100/70">Classes 8, 9 &amp; 10 · CBSE &amp; ICSE</p>
          {site.contact_email && (
            <a className="mt-3 block text-sm text-white underline-offset-4 hover:underline" href={`mailto:${site.contact_email}`}>
              {site.contact_email}
            </a>
          )}
        </div>
        <FooterCol
          title="Learn"
          links={[
            ["/notes", "Handwritten notes"],
            ["/tuition", "Chemistry tuition"],
            ["/doubts", "Doubt sessions"],
            ["/videos", "YouTube lessons"],
          ]}
        />
        <FooterCol
          title="Policies"
          links={[
            ["/policies/privacy", "Privacy policy"],
            ["/policies/terms", "Terms & conditions"],
            ["/policies/refunds", "Refund & cancellation"],
            ["/policies/notes", "Notes purchase policy"],
            ["/policies/booking", "Booking policy"],
          ]}
        />
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-white">Follow</h2>
          <ul className="mt-4 space-y-2.5 text-sm">
            {socials.length === 0 && <li className="text-navy-100/50">Links coming soon</li>}
            {socials.map((s) => (
              <li key={s.label}>
                <a href={s.href} target="_blank" rel="noopener noreferrer" className="text-navy-100/80 hover:text-white">
                  {s.label}
                </a>
              </li>
            ))}
            <li>
              <Link href="/contact" className="text-navy-100/80 hover:text-white">
                Contact us
              </Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="container-x flex flex-col gap-2 py-5 text-xs text-navy-100/60 sm:flex-row sm:justify-between">
          <p>
            © {new Date().getFullYear()} {site.business_name}. All rights reserved.
          </p>
          <p>Payments secured by Razorpay · Prices in INR (₹)</p>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div>
      <h2 className="text-sm font-bold uppercase tracking-wider text-white">{title}</h2>
      <ul className="mt-4 space-y-2.5 text-sm">
        {links.map(([href, label]) => (
          <li key={href}>
            <Link href={href} className="text-navy-100/80 hover:text-white">
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
