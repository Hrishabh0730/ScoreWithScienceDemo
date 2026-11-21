import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "@fontsource-variable/plus-jakarta-sans";
import "@fontsource/caveat/600.css";
import "./globals.css";
import { CartProvider } from "@/components/CartProvider";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { SITE_URL } from "@/lib/config";
import { getSettings } from "@/lib/data";

export async function generateMetadata(): Promise<Metadata> {
  const { site } = await getSettings();
  const description =
    "Handwritten Science notes (₹10 per chapter), affordable one-to-one Chemistry tuition and doubt-solving for Classes 8, 9 and 10 — CBSE and ICSE.";
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: `ScoreWithScience — ${site.tagline}`, template: "%s · ScoreWithScience" },
    description,
    applicationName: "ScoreWithScience",
    keywords: ["CBSE chemistry notes", "ICSE chemistry", "class 10 science notes", "chemistry tuition online", "handwritten notes", "doubt solving"],
    openGraph: { type: "website", siteName: "ScoreWithScience", locale: "en_IN", images: ["/logo.png"], description },
    twitter: { card: "summary", images: ["/logo.png"] },
    alternates: { canonical: "/" },
    verification: site.google_site_verification ? { google: site.google_site_verification } : undefined,
  };
}

export const viewport: Viewport = { themeColor: "#1b3663", width: "device-width", initialScale: 1 };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { site } = await getSettings();
  const ga = /^G-[A-Z0-9]{4,}$/.test(site.ga_measurement_id) ? site.ga_measurement_id : "";
  return (
    <html lang="en-IN">
      <body className="flex min-h-dvh flex-col">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2">
          Skip to content
        </a>
        <CartProvider>
          <Header />
          <main id="main" className="flex-1">
            {children}
          </main>
          <Footer site={site} />
          <WhatsAppButton number={site.whatsapp_number} />
        </CartProvider>
        {ga && (
          <>
            <Script src={`https://www.googletagmanager.com/gtag/js?id=${ga}`} strategy="afterInteractive" />
            <Script id="ga" strategy="afterInteractive">
              {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${ga}',{anonymize_ip:true});`}
            </Script>
          </>
        )}
      </body>
    </html>
  );
}
