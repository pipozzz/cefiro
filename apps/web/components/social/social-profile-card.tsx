"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

export type SocialProfileCardData = {
  handle: string;
  displayName: string | null;
  bio: string | null;
  avatarUrl: string | null;
  recipeCount: number;
};

export function SocialProfileCard({ profile }: { profile: SocialProfileCardData }) {
  const t = useTranslations("social.profileCard");
  const name = profile.displayName ?? `@${profile.handle}`;

  return (
    <Link
      href={`/u/${profile.handle}`}
      className="group flex items-center gap-3 rounded-2xl bg-content1 p-4 shadow-sm ring-1 ring-default-100 transition hover:-translate-y-0.5 hover:shadow-md"
    >
      {profile.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={profile.avatarUrl}
          alt=""
          className="h-12 w-12 flex-shrink-0 rounded-full object-cover"
        />
      ) : (
        <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-primary text-lg font-semibold text-primary-foreground">
          {name.charAt(0).toUpperCase()}
        </span>
      )}

      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-foreground group-hover:text-primary">{name}</p>
        <p className="truncate text-sm text-default-500">@{profile.handle}</p>
        {profile.bio ? (
          <p className="mt-1 line-clamp-1 text-sm text-default-500">{profile.bio}</p>
        ) : null}
      </div>

      {profile.recipeCount > 0 ? (
        <span className="flex-shrink-0 text-xs text-default-400">
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
