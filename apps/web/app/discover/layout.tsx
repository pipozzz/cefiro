import type { Metadata } from "next";
import { PublicHeader } from "@/components/social/public-header";
import { getTranslations } from "next-intl/server";

import { BaseProviders } from "../providers/base-providers";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("social.discover");
  const title = t("metaTitle");
  const description = t("metaDescription");

  return {
    title,
    description,
    openGraph: { type: "website", title, description, siteName: "Cefiro" },
    twitter: { card: "summary", title, description },
  };
}

export default function DiscoverLayout({ children }: { children: React.ReactNode }) {
  return (
    <BaseProviders>
      <div className="min-h-dvh">
        <PublicHeader />
        {children}
      </div>
    </BaseProviders>
  );
}
