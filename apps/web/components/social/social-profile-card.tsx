"use client";

import Link from "next/link";
import { LockClosedIcon } from "@heroicons/react/16/solid";
import { useTranslations } from "next-intl";

import { ChefHatIcon } from "./chef-hat-icon";

export type SocialProfileCardData = {
  handle: string;
  displayName: string | null;
  bio: string | null;
  avatarUrl: string | null;
  recipeCount: number;
  /** Optional so existing callers keep working; treated as public when absent. */
  isPublic?: boolean;
};

export function SocialProfileCard({ profile }: { profile: SocialProfileCardData }) {
  const t = useTranslations("social.profileCard");
  const name = profile.displayName ?? `@${profile.handle}`;
  const isPrivate = profile.isPublic === false;

  return (
    <Link
      className="group bg-content1 ring-default-100 flex items-center gap-3 rounded-2xl p-4 shadow-sm ring-1 transition hover:-translate-y-0.5 hover:shadow-md"
      href={`/u/${profile.handle}`}
    >
      {profile.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          alt=""
          className="h-12 w-12 flex-shrink-0 rounded-full object-cover"
          src={profile.avatarUrl}
        />
      ) : (
        <span className="bg-primary text-primary-foreground flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full">
          <ChefHatIcon className="h-6 w-6" />
        </span>
      )}

      <div className="min-w-0 flex-1">
        <p className="text-foreground group-hover:text-primary flex items-center gap-1 truncate font-semibold">
          <span className="truncate">{name}</span>
          {isPrivate ? (
            <LockClosedIcon
              aria-label={t("private")}
              className="text-default-400 h-3.5 w-3.5 flex-shrink-0"
            />
          ) : null}
        </p>
        <p className="text-default-500 truncate text-sm">@{profile.handle}</p>
        {profile.bio ? (
          <p className="text-default-500 mt-1 line-clamp-1 text-sm">{profile.bio}</p>
        ) : null}
      </div>

      {isPrivate ? (
        <span className="text-default-400 flex-shrink-0 text-xs">{t("private")}</span>
      ) : profile.recipeCount > 0 ? (
        <span className="text-default-400 flex-shrink-0 text-xs">
          {t("recipeCount", { count: profile.recipeCount })}
        </span>
      ) : null}
    </Link>
  );
}

export function SocialProfileGrid({ profiles }: { profiles: SocialProfileCardData[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {profiles.map((profile) => (
        <SocialProfileCard key={profile.handle} profile={profile} />
      ))}
    </div>
  );
}
