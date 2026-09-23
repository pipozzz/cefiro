"use client";

import type { CookingModeRecipe } from "@/app/(app)/recipes/[id]/components/cookingmode/types";
import { useEffect, useMemo, useState } from "react";
import { CookingModeHeader } from "@/app/(app)/recipes/[id]/components/cookingmode/cooking-mode-header";
import { resolveCookingModeSteps } from "@/app/(app)/recipes/[id]/components/cookingmode/cooking-mode-steps";
import { CookingStepView } from "@/app/(app)/recipes/[id]/components/cookingmode/cooking-step-view";
import { useIsDesktopCookingMode } from "@/app/(app)/recipes/[id]/components/cookingmode/use-is-desktop-cooking-mode";
import { PublicSlugSmartInstruction } from "@/components/recipe/public-slug-smart-instruction";
import { ChevronDownIcon, ChevronUpIcon, FireIcon } from "@heroicons/react/24/outline";
import { Button, Meter } from "@heroui/react";
import { useLocale, useTranslations } from "next-intl";

type CookStep = {
  step: string;
  systemUsed: string;
  order: number;
  images?: { image: string | null; order: number }[];
};

/**
 * The public recipe page's cook mode.
 *
 * It renders the *same* header and step view the in-app cooking mode uses
 * (`CookingModeHeader`, `CookingStepView`), so a recipe opened from discovery
 * cooks and looks exactly like one opened from the library — the big centred
 * step, the peeks of the steps either side, the page-turn animation, the step
 * images. The only difference is the step renderer injected into the view: the
 * slug-scoped, auth-free `PublicSlugSmartInstruction`, so timer chips still work
 * without touching any authenticated hook or private context.
 *
 * The in-app bottom bar's utilities (timers dock, voice, wake toggle) depend on
 * authenticated providers, so this keeps its own lean bar — progress, a "ready
 * around" projection, and back / next — and holds the screen awake itself.
 */
export function PublicCookMode({
  recipeId,
  recipeName,
  image,
  categories,
  steps,
  systemUsed,
  totalMinutes,
}: {
  recipeId: string;
  recipeName: string;
  image?: string | null;
  categories?: string[];
  steps: CookStep[];
  systemUsed: string;
  totalMinutes?: number | null;
}) {
  const t = useTranslations("social.recipe");
  const locale = useLocale();
  const isDesktop = useIsDesktopCookingMode();
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  // Fixed when the session begins: now + the recipe's total time. A projection,
  // never a promise — and absent for a recipe with no total time.
  const [readyAt, setReadyAt] = useState<Date | null>(null);

  // The same resolution the in-app cook mode uses: only the steps written in
  // this recipe's measurement system, headings folded in, images ordered.
  const cookSteps = useMemo(
    () =>
      resolveCookingModeSteps(
        steps.map((s) => ({
          step: s.step,
          systemUsed: s.systemUsed,
          order: s.order,
          images: (s.images ?? [])
            .filter((img): img is { image: string; order: number } => !!img.image)
            .map((img) => ({ image: img.image, order: img.order })),
          stepIngredients: [],
        })),
        systemUsed
      ),
    [steps, systemUsed]
  );

  const recipe: CookingModeRecipe = useMemo(
    () => ({
      id: recipeId,
      name: recipeName,
      image: image ?? null,
      categories: categories ?? [],
      totalMinutes: totalMinutes ?? null,
      servings: null,
      systemUsed,
    }),
    [recipeId, recipeName, image, categories, totalMinutes, systemUsed]
  );

  // Keep the screen on while cooking; re-acquire it if the tab was hidden.
  useEffect(() => {
    if (!open || typeof navigator === "undefined") {
      return;
    }

    let lock: { release: () => Promise<void> } | null = null;
    const request = async () => {
      try {
        lock = await (
          navigator as Navigator & {
            wakeLock?: { request: (t: "screen") => Promise<typeof lock> };
          }
        ).wakeLock?.request("screen");
      } catch {
        // Wake Lock unsupported or denied — cooking still works, screen may dim.
      }
    };

    void request();
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void request();
      }
    };

    document.addEventListener("visibilitychange", onVisible);

    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      void lock?.release().catch(() => {});
    };
  }, [open]);

  // Escape closes; arrow keys page through steps.
  useEffect(() => {
    if (!open) {
      return;
    }

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
      else if (e.key === "ArrowRight" || e.key === "ArrowDown")
        setIndex((v) => Math.min(cookSteps.length - 1, v + 1));
      else if (e.key === "ArrowLeft" || e.key === "ArrowUp") setIndex((v) => Math.max(0, v - 1));
    };

    window.addEventListener("keydown", onKey);

    return () => window.removeEventListener("keydown", onKey);
  }, [open, cookSteps.length]);

  if (cookSteps.length === 0) {
    return null;
  }

  const isLast = index === cookSteps.length - 1;
  const progress = ((index + 1) / cookSteps.length) * 100;
  const stepCounter = t("cookStep", { current: index + 1, total: cookSteps.length });

  const startCooking = () => {
    setIndex(0);
    setReadyAt(
      totalMinutes && totalMinutes > 0 ? new Date(Date.now() + totalMinutes * 60_000) : null
    );
    setOpen(true);
  };

  return (
    <>
      <button
        className="bg-accent text-accent-foreground inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition hover:opacity-90"
        style={{ background: "var(--accent, #336640)", color: "#fff" }}
        type="button"
        onClick={startCooking}
      >
        <FireIcon className="h-5 w-5" />
        <span>{t("cook")}</span>
      </button>

      {open ? (
        <div
          aria-modal="true"
          className="bg-background/75 fixed inset-0 z-[1100] flex backdrop-blur-sm md:items-center md:justify-center md:p-8"
          role="dialog"
        >
          {/* Match the in-app cook mode: a centred card on desktop, fullscreen
              on phones. */}
          <div
            className={
              isDesktop
                ? "bg-surface shadow-overlay flex h-[min(92dvh,900px)] w-[min(1180px,calc(100vw-4rem))] flex-col overflow-hidden rounded-3xl"
                : "bg-background flex h-[100dvh] w-[100dvw] flex-col overflow-hidden"
            }
          >
            <CookingModeHeader recipe={recipe} onClose={() => setOpen(false)} />

            <div className="min-h-0 flex-1 overflow-hidden">
              <CookingStepView
                InstructionComponent={PublicSlugSmartInstruction}
                activeStep={index}
                displayIngredients={[]}
                recipe={recipe}
                steps={cookSteps}
              />
            </div>

            {/* Bottom bar mirrors the in-app cook mode's layout: meter, ready-at +
              counter, then back / next. */}
            <div className="border-border shrink-0 border-t px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] md:px-6 md:pt-4 md:pb-4">
              <Meter aria-label={stepCounter} className="w-full" color="accent" value={progress}>
                <Meter.Track>
                  <Meter.Fill />
                </Meter.Track>
              </Meter>

              <div className="mt-2 flex items-center justify-between gap-3 text-sm">
                <span className="text-muted truncate">
                  {readyAt
                    ? t("cookReadyAt", {
                        time: readyAt.toLocaleTimeString(locale, {
                          hour: "2-digit",
                          minute: "2-digit",
                        }),
                      })
                    : ""}
                </span>
                <span className="text-muted shrink-0 font-medium tabular-nums">{stepCounter}</span>
              </div>

              <div className="mt-3 flex items-center justify-between gap-2">
                <Button
                  isIconOnly
                  aria-label={t("cookPrev")}
                  className="size-10 min-w-10 rounded-full"
                  isDisabled={index === 0}
                  variant="secondary"
                  onPress={() => setIndex((v) => Math.max(0, v - 1))}
                >
                  <ChevronUpIcon className="size-5" />
                </Button>

                <Button
                  className="shrink-0 rounded-full"
                  variant="primary"
                  onPress={() => (isLast ? setOpen(false) : setIndex((v) => v + 1))}
                >
                  <span>{isLast ? t("cookDone") : t("cookNext")}</span>
                  <ChevronDownIcon className="size-5" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
