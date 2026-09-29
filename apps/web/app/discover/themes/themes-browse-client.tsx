"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { MagnifyingGlassIcon, XMarkIcon } from "@heroicons/react/16/solid";
import { Input } from "@heroui/react";
import { useTranslations } from "next-intl";

type Theme = { slug: string; name: string; recipeCount: number; image: string | null };
type Sort = "popular" | "name";

const pill = (active: boolean) =>
  `rounded-full border px-4 py-1.5 text-sm font-medium transition ${
    active
      ? "border-transparent bg-[var(--accent)] text-white shadow-sm"
      : "border-border bg-content2 text-default-600 hover:bg-content3"
  }`;

/**
 * The dedicated themes browse surface: every theme as a tile, filterable by name
 * and sortable by popularity (recipe count) or A–Z. Each tile links to the
 * theme's own stable page (/discover/themes/[slug]) where its recipes render, so
 * the whole thing is crawlable and shareable. Themes are a small set, so search
 * and sort run client-side over the server-provided list.
 */
export function ThemesBrowseClient({ themes }: { themes: Theme[] }) {
  const t = useTranslations("social.themesPage");
  const tDiscover = useTranslations("social.discover");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<Sort>("popular");

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const filtered = needle
      ? themes.filter((theme) => theme.name.toLowerCase().includes(needle))
      : themes;

    return [...filtered].sort((a, b) =>
      sort === "name" ? a.name.localeCompare(b.name) : b.recipeCount - a.recipeCount
    );
  }, [themes, q, sort]);

  return (
    <div>
      <div className="relative mb-4 w-full">
        <MagnifyingGlassIcon className="text-muted pointer-events-none absolute top-1/2 left-4 z-10 h-5 w-5 -translate-y-1/2" />
        <Input
          fullWidth
          aria-label={t("searchAria")}
          className="bg-field shadow-field h-12 rounded-full border border-transparent text-[15px] transition-colors outline-none"
          placeholder={t("searchPlaceholder")}
          style={{
            fontSize: "16px",
            paddingLeft: "2.75rem",
            paddingRight: q.length > 0 ? "2.75rem" : "1rem",
          }}
          value={q}
          variant="primary"
          onChange={(e) => setQ(e.target.value)}
        />
        {q ? (
          <button
            aria-label={t("clearSearch")}
            className="text-muted hover:bg-surface-secondary hover:text-foreground absolute top-1/2 right-2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full transition-colors"
            type="button"
            onClick={() => setQ("")}
            onMouseDown={(e) => e.preventDefault()}
          >
            <XMarkIcon className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <span className="text-default-500 mr-1 text-sm">{t("sortLabel")}</span>
        <button
          className={pill(sort === "popular")}
          type="button"
          onClick={() => setSort("popular")}
        >
          {t("sortPopular")}
        </button>
        <button className={pill(sort === "name")} type="button" onClick={() => setSort("name")}>
          {t("sortName")}
        </button>
      </div>

      {visible.length === 0 ? (
        <div className="bg-content2 text-default-500 rounded-2xl p-10 text-center">
          <p>{t("noneMatch")}</p>
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {visible.map((theme) => (
            <li key={theme.slug}>
              <Link
                className="bg-content2 hover:bg-content3 block overflow-hidden rounded-2xl no-underline transition"
                href={`/discover/themes/${theme.slug}`}
              >
                <div className="bg-content3 relative h-28 w-full">
                  {theme.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      alt=""
                      className="h-full w-full object-cover"
                      loading="lazy"
                      src={theme.image}
                    />
                  ) : (
                    <div className="text-default-400 flex h-full w-full items-center justify-center text-3xl font-semibold">
                      {theme.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <span className="text-foreground block truncate font-medium">{theme.name}</span>
                  <span className="text-default-500 text-xs">
                    {tDiscover("themeCount", { count: theme.recipeCount })}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
