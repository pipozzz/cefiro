"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

import { FollowButton } from "./follow-button";

export type CookCardData = {
  handle: string;
  displayName: string | null;
  bio: string | null;
  avatarUrl: string | null;
  recipeCount: number;
};

export function CookCard({ cook }: { cook: CookCardData }) {
  const tCard = useTranslations("social.profileCard");
  const name = cook.displayName ?? `@${cook.handle}`;

  return (
    <li className="flex items-center gap-3 rounded-2xl bg-content1 p-4 shadow-sm ring-1 ring-default-100">
      <Link href={`/u/${cook.handle}`} className="flex min-w-0 flex-1 items-center gap-3">
        {cook.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cook.avatarUrl}
            alt=""
            className="h-11 w-11 flex-shrink-0 rounded-full object-cover"
          />
        ) : (
          <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-primary text-base font-semibold text-primary-foreground">
            {name.charAt(0).toUpperCase()}
          </span>
        )}
        <span className="min-w-0">
          <span className="block truncate font-semibold text-foreground">{name}</span>
          <span className="block truncate text-xs text-default-500">
            {cook.recipeCount > 0
              ? tCard("recipeCount", { count: cook.recipeCount })
              : `@${cook.handle}`}
          </span>
        </span>
      </Link>
      <FollowButton handle={cook.handle} />
    </li>
  );
}

export function CookGrid({ cooks }: { cooks: CookCardData[] }) {
  return (
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {cooks.map((cook) => (
        <CookCard key={cook.handle} cook={cook} />
      ))}
    </ul>
  );
}
