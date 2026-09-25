import type { Metadata } from "next";
import { PRIVACY } from "@/components/legal/legal-content";
import { LegalDocumentView } from "@/components/legal/legal-document";
import { PublicHeader } from "@/components/social/public-header";
import { getLocale } from "next-intl/server";

export const metadata: Metadata = {
  title: "Zásady ochrany súkromia · Naša Kuchyňa",
  robots: { index: true, follow: true },
};

export default async function PrivacyPage() {
  const locale = await getLocale();
  const doc = locale === "sk" ? PRIVACY.sk : PRIVACY.en;

  return (
    <>
      <PublicHeader />
      <LegalDocumentView doc={doc} />
    </>
  );
}
