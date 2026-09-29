import type { Metadata } from "next";
import { AboutMarkdown } from "@/components/about/about-markdown";
import { PublicFooter } from "@/components/social/public-footer";
import { PublicHeader } from "@/components/social/public-header";
import { getLocale } from "next-intl/server";

import { getAboutContent } from "@norish/shared-server/config/server-config-loader";

// Content is admin-editable (stored in server config), so render fresh.
export const dynamic = "force-dynamic";

const META_DESCRIPTION =
  "Naša Kuchyňa je komunitná platforma na objavovanie, zdieľanie a plánovanie domácich receptov.";

export const metadata: Metadata = {
  title: "O nás · Naša Kuchyňa",
  description: META_DESCRIPTION,
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    title: "O nás · Naša Kuchyňa",
    description: META_DESCRIPTION,
    siteName: "Naša Kuchyňa",
    images: [{ url: "/og-default.png", width: 1200, height: 630, alt: "Naša Kuchyňa" }],
  },
  twitter: { card: "summary_large_image" },
};

export default async function AboutPage() {
  const [locale, about] = await Promise.all([getLocale(), getAboutContent()]);
  const doc = locale === "sk" ? about.sk : about.en;

  return (
    <>
      <PublicHeader />
      <article className="mx-auto w-full max-w-3xl px-4 py-10 md:px-6">
        <h1 className="text-foreground text-3xl font-bold">{doc.title}</h1>
        <AboutMarkdown>{doc.body}</AboutMarkdown>
      </article>
      <PublicFooter />
    </>
  );
}
