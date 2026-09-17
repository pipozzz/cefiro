"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

export type SocialCookbookCardData = {
  slug: string;
  title: string;
  description: string | null;
  recipeCount: number;
  coverImages: string[];
  owner: {
    handle: string;
    displayName: string | null;
    avatarUrl: string | null;
  } | null;
};

function CookbookCard({ cookbook }: { cookbook: SocialCookbookCardData }) {
  const t = useTranslations("social.profileCard");
  const covers = cookbook.coverImages.slice(0, 4);
  const ownerName =
    cookbook.owner?.displayName ?? (cookbook.owner ? `@${cookbook.owner.handle}` : null);

  return (
    <div className="group bg-content1 ring-default-100 flex flex-col overflow-hidden rounded-2xl shadow-sm ring-1 transition hover:-translate-y-0.5 hover:shadow-md">
      <Link
        href={`/c/${cookbook.slug}`}
        className="bg-content2 grid aspect-[3/2] w-full grid-cols-2 grid-rows-2 gap-0.5"
      >
        {covers.length > 0
          ? Array.from({ length: 4 }).map((_, i) =>
              covers[i] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={i} src={covers[i]} alt="" className="h-full w-full object-cover" />
              ) : (
                <div key={i} className="bg-content3 h-full w-full" />
              )
            )
          : null}
      </Link>

      <div className="flex flex-1 flex-col p-4">
        <Link href={`/c/${cookbook.slug}`}>
          <h3 className="text-foreground group-hover:text-primary line-clamp-1 font-semibold">
            {cookbook.title}
          </h3>
        </Link>
        <p className="text-default-500 mt-0.5 text-xs">
          {t("recipeCount", { count: cookbook.recipeCount })}
        </p>
        {cookbook.description ? (
          <p className="text-default-500 mt-1 line-clamp-2 text-sm">{cookbook.description}</p>
        ) : null}

        {cookbook.owner && ownerName ? (
          <Link
            href={`/u/${cookbook.owner.handle}`}
            className="text-default-500 hover:text-foreground mt-3 inline-flex items-center gap-2 text-sm"
          >
            {cookbook.owner.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={cookbook.owner.avatarUrl}
                alt=""
                className="h-5 w-5 rounded-full object-cover"
              />
            ) : (
              <span className="bg-primary text-primary-foreground flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold">
                {ownerName.charAt(0).toUpperCase()}
              </span>
            )}
            <span className="truncate">{ownerName}</span>
          </Link>
        ) : null}
      </div>
    </div>
  );
}

export function SocialCookbookGrid({ cookbooks }: { cookbooks: SocialCookbookCardData[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {cookbooks.map((cookbook) => (
        <CookbookCard key={cookbook.slug} cookbook={cookbook} />
      ))}
    </div>
  );
}
