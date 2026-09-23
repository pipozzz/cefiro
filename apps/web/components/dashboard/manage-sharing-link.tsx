"use client";

import Link from "next/link";
import { GlobeAltIcon } from "@heroicons/react/16/solid";
import { useTranslations } from "next-intl";

/**
 * Library-header entry to the bulk sharing manager — the discoverable way for an
 * owner to turn many recipes public at once.
 */
export default function ManageSharingLink() {
  const t = useTranslations("social.sharing");

  return (
    <Link
      aria-label={t("manage")}
      className="text-default-600 hover:text-foreground hover:bg-content2 inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-sm font-medium no-underline transition"
      href="/library/sharing"
      title={t("manage")}
    >
      <GlobeAltIcon className="h-4 w-4" />
      <span className="hidden sm:inline">{t("manage")}</span>
    </Link>
  );
}
