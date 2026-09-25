import type { Metadata } from "next";
import { TERMS } from "@/components/legal/legal-content";
import { LegalDocumentView } from "@/components/legal/legal-document";
import { PublicHeader } from "@/components/social/public-header";
import { getLocale } from "next-intl/server";

export const metadata: Metadata = {
  title: "Podmienky používania · Naša Kuchyňa",
  robots: { index: true, follow: true },
};

export default async function TermsPage() {
  const locale = await getLocale();
  const doc = locale === "sk" ? TERMS.sk : TERMS.en;

  return (
    <>
      <PublicHeader />
      <LegalDocumentView doc={doc} />
    </>
  );
}
