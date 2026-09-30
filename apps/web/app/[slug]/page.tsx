import type { Metadata } from "next";
import { cache } from "react";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { AboutMarkdown } from "@/components/about/about-markdown";
import { PublicFooter } from "@/components/social/public-footer";
import { PublicHeader } from "@/components/social/public-header";

import { getPublishedPageBySlug } from "@norish/db/repositories/pages";

// Content is admin-editable, so render fresh (also keeps this catch-all out of
// the static route cache).
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

async function siteOrigin(): Promise<string> {
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("x-forwarded-host") ?? h.get("host");

  return host ? `${proto}://${host}` : "";
}

/** A published custom page, or null. Never throws; deduped per request. */
const loadPage = cache(async (slug: string) => {
  try {
    return await getPublishedPageBySlug(slug);
  } catch {
    return null;
  }
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const page = await loadPage(slug);

  if (!page) {
    return {};
  }

  const description = page.metaDescription ?? undefined;
  const origin = await siteOrigin();
  const url = origin ? `${origin}/${slug}` : undefined;

  return {
    title: page.title,
    description,
    robots: { index: true, follow: true },
    alternates: url ? { canonical: url } : undefined,
    openGraph: { title: page.title, description, url, type: "website" },
  };
}

/**
 * A custom CMS page served at a root URL `/{slug}`. This catch-all only receives
 * single-segment paths not claimed by a real route; unknown/draft slugs 404.
 */
export default async function CustomPage({ params }: Props) {
  const { slug } = await params;
  const page = await loadPage(slug);

  if (!page) {
    notFound();
  }

  return (
    <>
      <PublicHeader />
      <article className="mx-auto w-full max-w-3xl px-4 py-10 md:px-6">
        <h1 className="text-foreground text-3xl font-bold">{page.title}</h1>
        <AboutMarkdown>{page.body}</AboutMarkdown>
      </article>
      <PublicFooter />
    </>
  );
}
