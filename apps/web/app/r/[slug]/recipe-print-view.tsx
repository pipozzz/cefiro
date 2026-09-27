"use client";

import OriginFlag from "@/components/recipes/origin-flag";
import { useLocale, useTranslations } from "next-intl";

import type { RouterOutputs } from "@norish/trpc/client";
import { useUnitFormatter } from "@norish/shared-react/hooks";
import { formatAmount } from "@norish/shared/lib/format-amount";

type Recipe = RouterOutputs["social"]["getPublicRecipe"]["recipe"];
type Ingredient = Recipe["recipeIngredients"][number];
type UnitsMap = Parameters<typeof useUnitFormatter>[0]["units"];

/**
 * A dedicated, print-only cookbook layout for a recipe (`hidden print:block`).
 *
 * The interactive screen view (scaled controls, timers, checkboxes, dark theme)
 * does not print well, so `@media print` hides it and shows this instead: a
 * compact, black-on-white page — hero photo, ingredients box, numbered steps
 * with their photos — that you can print, bind and cook from. Amounts follow the
 * yield currently selected on screen.
 */
export function RecipePrintView({
  recipe,
  ingredients,
  servings,
  units,
}: {
  recipe: Recipe;
  ingredients: Ingredient[];
  servings: number;
  units: UnitsMap;
}) {
  const t = useTranslations("social.recipe");
  const locale = useLocale();
  const { formatUnitOnly } = useUnitFormatter({ locale, units });

  const meta = [
    recipe.prepMinutes ? `${t("prep")} ${recipe.prepMinutes} min` : null,
    recipe.cookMinutes ? `${t("cook")} ${recipe.cookMinutes} min` : null,
    recipe.totalMinutes ? `${t("total")} ${recipe.totalMinutes} min` : null,
    servings > 0 ? `${servings} ${t("servings")}` : null,
  ].filter(Boolean);

  const steps = [...recipe.steps].sort((a, b) => a.order - b.order);

  return (
    <div className="recipe-print-view hidden text-black print:block">
      {/* Brand letterhead — the pot mark + wordmark at the top of the page. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img alt="Naša Kuchyňa" className="mb-3 h-8 w-auto" src="/logo.svg" />

      <header className="mb-4 border-b border-black/20 pb-3">
        <h1 className="text-2xl font-bold">
          <OriginFlag className="mr-1.5" originCountry={recipe.originCountry} />
          {recipe.name}
        </h1>
        {recipe.description ? (
          <p className="mt-1 text-sm text-black/70 italic">{recipe.description}</p>
        ) : null}
        {meta.length > 0 ? (
          <p className="mt-2 text-xs tracking-wide text-black/60 uppercase">{meta.join(" · ")}</p>
        ) : null}
      </header>

      {recipe.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          alt=""
          className="mb-4 max-h-[7cm] w-full rounded-lg object-cover"
          src={recipe.image}
          style={{ breakInside: "avoid" }}
        />
      ) : null}

      <div className="grid grid-cols-[minmax(0,7cm)_1fr] gap-6">
        <section style={{ breakInside: "avoid" }}>
          <h2 className="mb-2 text-sm font-bold tracking-wide uppercase">{t("ingredients")}</h2>
          <ul className="space-y-1 text-sm">
            {ingredients.map((ing, i) => {
              const amount = ing.amount != null ? formatAmount(ing.amount) : "";
              const unit = ing.unit ? formatUnitOnly(ing.unit, ing.amount) : "";
              const qty = [amount, unit].filter(Boolean).join(" ");

              return (
                <li
                  key={i}
                  className="flex justify-between gap-2 border-b border-dotted border-black/15 pb-1"
                >
                  <span>{ing.ingredientName}</span>
                  {qty ? <span className="shrink-0 font-medium">{qty}</span> : null}
                </li>
              );
            })}
          </ul>
        </section>

        <section>
          <h2 className="mb-2 text-sm font-bold tracking-wide uppercase">{t("steps")}</h2>
          <ol className="space-y-3 text-sm">
            {steps.map((step, i) => (
              <li key={i} className="flex gap-3" style={{ breakInside: "avoid" }}>
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-black/40 text-xs font-bold">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="leading-relaxed whitespace-pre-line">{step.step}</p>
                  {step.images[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      alt=""
                      className="mt-2 max-h-[4cm] rounded object-cover"
                      src={step.images[0].image}
                    />
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        </section>
      </div>

      {recipe.notes ? (
        <section className="mt-4 border-t border-black/20 pt-3" style={{ breakInside: "avoid" }}>
          <h2 className="mb-1 text-xs font-bold tracking-wide uppercase">{t("notes")}</h2>
          <p className="text-sm whitespace-pre-line text-black/80">{recipe.notes}</p>
        </section>
      ) : null}

      {recipe.calories || recipe.protein || recipe.carbs || recipe.fat ? (
        <p className="mt-4 text-xs text-black/60">
          {[
            recipe.calories ? `${recipe.calories} kcal` : null,
            recipe.protein ? `${t("protein")} ${recipe.protein} g` : null,
            recipe.carbs ? `${t("carbs")} ${recipe.carbs} g` : null,
            recipe.fat ? `${t("fat")} ${recipe.fat} g` : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      ) : null}

      <p className="mt-4 border-t border-black/20 pt-2 text-[10px] text-black/50">nasakuchyna.sk</p>
    </div>
  );
}
