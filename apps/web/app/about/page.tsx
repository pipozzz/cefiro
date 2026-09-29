import type { Metadata } from "next";
import { ABOUT } from "@/components/about/about-content";
import { PublicFooter } from "@/components/social/public-footer";
import { PublicHeader } from "@/components/social/public-header";
import { getLocale } from "next-intl/server";

export const metadata: Metadata = {
  title: "O nás · Naša Kuchyňa",
  description:
    "Naša Kuchyňa je komunitná platforma na objavovanie, zdieľanie a plánovanie domácich receptov.",
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    title: "O nás · Naša Kuchyňa",
    description:
      "Naša Kuchyňa je komunitná platforma na objavovanie, zdieľanie a plánovanie domácich receptov.",
    siteName: "Naša Kuchyňa",
    images: [{ url: "/og-default.png", width: 1200, height: 630, alt: "Naša Kuchyňa" }],
  },
  twitter: { card: "summary_large_image" },
};

export default async function AboutPage() {
  const locale = await getLocale();
  const doc = locale === "sk" ? ABOUT.sk : ABOUT.en;

  return (
    <>
      <PublicHeader />
      <article className="mx-auto w-full max-w-3xl px-4 py-10 md:px-6">
        <h1 className="text-foreground text-3xl font-bold">{doc.title}</h1>

        {doc.intro.map((paragraph, i) => (
          <p key={i} className="text-default-700 mt-6 text-lg leading-relaxed">
            {paragraph}
          </p>
        ))}

        {doc.sections.map((section) => (
          <section key={section.heading} className="mt-8">
            <h2 className="text-foreground text-lg font-semibold">{section.heading}</h2>
            {section.body.map((paragraph, i) => (
              <p key={i} className="text-default-700 mt-2 leading-relaxed">
                {paragraph}
              </p>
            ))}
          </section>
        ))}
      </article>
      <PublicFooter />
    </>
  );
}
