import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { BrandLogo } from "@/components/brand/brand-logo";

import { auth } from "@norish/auth/auth";

import { BaseProviders } from "../providers/base-providers";

export const metadata: Metadata = {
  title: "Discover recipes",
  description: "Explore recipes shared by the Cefiro community.",
  openGraph: {
    type: "website",
    title: "Discover recipes",
    description: "Explore recipes shared by the Cefiro community.",
    siteName: "Cefiro",
  },
  twitter: {
    card: "summary",
    title: "Discover recipes",
    description: "Explore recipes shared by the Cefiro community.",
  },
};

export default async function DiscoverLayout({ children }: { children: React.ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() });
  const isAuthed = !!session?.user?.id;
  const t = await getTranslations("social.discover");

  return (
    <BaseProviders>
      <div className="min-h-dvh">
        <header className="flex items-center justify-between px-4 py-4 md:px-6">
          <Link href={isAuthed ? "/" : "/discover"} aria-label="Cefiro" className="flex items-center">
            <BrandLogo priority height={28} width={112} />
          </Link>
          {isAuthed ? (
            <Link href="/" className="text-sm font-medium text-primary hover:underline">
              {t("openApp")}
            </Link>
          ) : (
            <Link
              href="/login"
              className="rounded-full bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground transition hover:opacity-90"
            >
              {t("signIn")}
            </Link>
          )}
        </header>
        {children}
      </div>
    </BaseProviders>
  );
}
