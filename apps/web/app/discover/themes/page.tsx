import type { Metadata } from "next";
import { cache } from "react";
import { headers } from "next/headers";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { appRouter, createHttpContextFromHeaders } from "@norish/trpc/server";

import { ThemesBrowseClient } from "./themes-browse-client";

// Fresh server render so the theme set (and its links) are always current HTML
// for crawlers and readers.
export const dynamic = "force-dynamic";

async function siteOrigin(): Promise<string> {
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("x-forwarded-host") ?? h.get("host");

  return host ? `${proto}://${host}` : "";
}

/** Every current theme (name-slugged), server-loaded so the tiles' links are in
 * the initial HTML. Never throws — an empty list renders the empty state. */
const loadThemes = cache(async () => {
  try {
    const ctx = await createHttpContextFromHeaders(new Headers(await headers()), null);
    const caller = appRouter.createCaller(ctx);
    const { themes } = await caller.social.themesList({ limit: 120 });

    return themes;
  } catch {
    return [];
  }
});

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("social.themesPage");
  const title = t("indexTitle");
  const description = t("indexSubtitle");
  const origin = await siteOrigin();
  const url = origin ? `${origin}/discover/themes` : undefined;

  return {
    title,
    description,
    alternates: url ? { canonical: url } : undefined,
    openGraph: { title, description, url, type: "website" },
    twitter: { card: "summary", title, description },
  };
}

export default async function ThemesIndexPage() {
  const t = await getTranslations("social.themesPage");
  const themes = await loadThemes();

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-24 md:px-6">
      <header className="mt-4 mb-6">
        <h1 className="text-foreground text-3xl font-bold">{t("indexTitle")}</h1>
        <p className="text-default-500 mt-1">{t("indexSubtitle")}</p>
      </header>

      {themes.length === 0 ? (
        <div className="bg-content2 text-default-500 rounded-2xl p-10 text-center">
          <p>{t("empty")}</p>
          <Link className="text-primary mt-2 inline-block hover:underline" href="/discover">
            {t("browseAll")}
          </Link>
        </div>
      ) : (
        <ThemesBrowseClient themes={themes} />
      )}
    </div>
  );
}
