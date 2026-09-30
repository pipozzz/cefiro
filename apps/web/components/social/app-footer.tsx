"use client";

import type { FooterLink } from "@/lib/footer-links";
import Link from "next/link";
import { mergeFooterLinks } from "@/lib/footer-links";
import { useTranslations } from "next-intl";

/**
 * The footer shown inside the signed-in app shell. A client component (the app
 * shell renders client-side offline, so a server footer can't live here): the
 * configured links are passed in from the server layout, and merged with the
 * built-in localized About/Terms/Privacy — the same links the public footer
 * shows. When nothing is passed (e.g. the offline bootstrap) it falls back to
 * just the built-in links.
 */
export function AppFooter({ configured = [] }: { configured?: FooterLink[] }) {
  const t = useTranslations("social.footer");
  const year = new Date().getFullYear();

  const links = mergeFooterLinks(
    [
      { label: t("about"), url: "/about" },
      { label: t("terms"), url: "/terms" },
      { label: t("privacy"), url: "/privacy" },
    ],
    configured
  );

  return (
    <footer className="border-border mt-16 border-t pt-8 print:hidden">
      <div className="text-default-500 flex w-full flex-col items-center justify-between gap-3 text-sm sm:flex-row">
        <span>© {year} Naša Kuchyňa</span>
        <nav className="flex flex-wrap items-center gap-x-5 gap-y-2">
          {links.map((link) => (
            <Link
              key={`${link.label}:${link.url}`}
              className="hover:text-foreground transition"
              href={link.url}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
