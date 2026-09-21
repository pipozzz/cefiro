"use client";

import { PrinterIcon } from "@heroicons/react/24/outline";
import { useTranslations } from "next-intl";

/**
 * Opens the browser print dialog for the recipe. The page's `print:hidden`
 * classes drop the chrome (header, action bar, comments) so the printout is
 * just the recipe — title, meta, ingredients and steps.
 */
export function PrintRecipeButton() {
  const t = useTranslations("social.recipe");

  return (
    <button
      className="border-default-200 bg-content1 text-default-600 hover:bg-content2 inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition"
      type="button"
      onClick={() => window.print()}
    >
      <PrinterIcon className="h-5 w-5" />
      <span>{t("print")}</span>
    </button>
  );
}
