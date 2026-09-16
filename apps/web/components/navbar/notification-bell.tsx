"use client";

import NextLink from "next/link";
import { usePathname } from "next/navigation";
import { useTRPC } from "@/app/providers/trpc-provider";
import { BellIcon } from "@heroicons/react/24/outline";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

/**
 * Notification bell for the navbar: an unread-count badge over a bell that
 * links to /notifications. Polls the unread count periodically. `variant`
 * tunes sizing for the desktop bar vs the mobile floating dock.
 */
export function NotificationBell({ variant = "desktop" }: { variant?: "desktop" | "mobile" }) {
  const trpc = useTRPC();
  const pathname = usePathname();
  const t = useTranslations("navbar.nav");

  const unreadQuery = useQuery({
    ...trpc.social.getUnreadNotificationCount.queryOptions(),
    retry: false,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });

  const count = unreadQuery.data?.count ?? 0;
  const active = pathname?.startsWith("/notifications");

  const base =
    variant === "mobile"
      ? `flex items-center justify-center rounded-full p-2.5 transition-colors ${
          active
            ? "bg-accent-soft text-accent"
            : "text-chrome-muted hover:text-chrome-foreground hover:bg-chrome-hover"
        }`
      : `hover:text-accent relative flex items-center rounded-full p-2 transition-colors ${
          active ? "text-accent" : "text-foreground/80"
        }`;

  return (
    <NextLink
      href="/notifications"
      aria-label={t("notifications")}
      title={t("notifications")}
      className={`relative ${base}`}
    >
      <BellIcon className="h-5 w-5" />
      {count > 0 ? (
        <span className="absolute -top-0.5 -right-0.5 flex min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] leading-4 font-semibold text-white">
          {count > 9 ? "9+" : count}
        </span>
      ) : null}
    </NextLink>
  );
}
