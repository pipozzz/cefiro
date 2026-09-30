"use client";

import Link from "next/link";
import { LockClosedIcon } from "@heroicons/react/16/solid";
import { useTranslations } from "next-intl";

import { ChefHatIcon } from "./chef-hat-icon";
import { FollowButton } from "./follow-button";

export type CookCardData = {
  handle: string;
  displayName: string | null;
  bio: string | null;
  avatarUrl: string | null;
  recipeCount: number;
  /** Optional so existing callers keep working; treated as public when absent. */
  isPublic?: boolean;
};

export function CookCard({ cook }: { cook: CookCardData }) {
  const tCard = useTranslations("social.profileCard");
  const name = cook.displayName ?? `@${cook.handle}`;
  const isPrivate = cook.isPublic === false;

  return (
    <li className="bg-content1 ring-default-100 flex items-center gap-3 rounded-2xl p-4 shadow-sm ring-1">
      <Link className="flex min-w-0 flex-1 items-center gap-3" href={`/u/${cook.handle}`}>
        {cook.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            alt=""
            className="h-11 w-11 flex-shrink-0 rounded-full object-cover"
            src={cook.avatarUrl}
          />
        ) : (
          <span className="bg-primary text-primary-foreground flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full">
            <ChefHatIcon className="h-6 w-6" />
          </span>
        )}
        <span className="min-w-0">
          <span className="text-foreground flex items-center gap-1 font-semibold">
            <span className="truncate">{name}</span>
            {isPrivate ? (
              <LockClosedIcon
                aria-label={tCard("private")}
                className="text-default-400 h-3.5 w-3.5 flex-shrink-0"
              />
            ) : null}
          </span>
          <span className="text-default-500 block truncate text-xs">
            {isPrivate
              ? `@${cook.handle}`
              : cook.recipeCount > 0
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
