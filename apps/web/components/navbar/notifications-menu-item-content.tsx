"use client";

import { useTRPC } from "@/app/providers/trpc-provider";
import { BellIcon } from "@heroicons/react/16/solid";
import { Label } from "@heroui/react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

/**
 * The inner content of the user menu's "Notifications" item — bell, label and
 * an unread-count badge. Split into its own component so the `useTRPC` unread
 * query lives here, mounted only where the item is rendered (the mobile bar's
 * menu). The desktop bar keeps its standalone {@link NotificationBell}, so the
 * menu item — and this query — never mount there; that also keeps the
 * provider-less `NavbarUserMenu` unit test from needing a TRPC context.
 */
export function NotificationsMenuItemContent() {
  const trpc = useTRPC();
  const t = useTranslations("navbar.nav");

  const unreadQuery = useQuery({
    ...trpc.social.getUnreadNotificationCount.queryOptions(),
    retry: false,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });

  const count = unreadQuery.data?.count ?? 0;

  return (
    <>
      <span className="text-muted relative">
        <BellIcon className="size-5" />
        {count > 0 ? (
          <span className="absolute -top-1.5 -right-1.5 flex min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] leading-4 font-semibold text-white">
            {count > 9 ? "9+" : count}
          </span>
        ) : null}
      </span>
      <Label className="text-base leading-tight font-medium">{t("notifications")}</Label>
    </>
  );
}
