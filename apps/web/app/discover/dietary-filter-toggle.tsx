"use client";

import { useActiveAllergies } from "@/hooks/user";
import { ShieldCheckIcon } from "@heroicons/react/24/outline";
import { useTranslations } from "next-intl";

/**
 * Dietary-aware discovery toggle: "Hide my allergens". Rendered only for a
 * signed-in reader who actually has allergens set (so it never nags anyone
 * else), and only under the app shell where the allergy/household context is
 * available. When on, the discover query asks the server to drop recipes tagged
 * with any of the reader's allergen tags — the allergens themselves are
 * resolved server-side, never sent from here.
 */
export function DietaryFilterToggle({
  enabled,
  onChange,
}: {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
}) {
  const t = useTranslations("social.discover");
  const { allergies } = useActiveAllergies();

  if (allergies.length === 0) {
    return null;
  }

  return (
    <button
      aria-pressed={enabled}
      className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition ${
        enabled
          ? "bg-primary text-primary-foreground"
          : "bg-content2 text-default-600 hover:bg-content3"
      }`}
      type="button"
      onClick={() => onChange(!enabled)}
    >
      <ShieldCheckIcon className="h-4 w-4" />
      {t("hideAllergens")}
    </button>
  );
}
