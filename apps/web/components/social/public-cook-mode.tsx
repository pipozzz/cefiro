"use client";

import type {
  CookingModeRecipe,
  CookingModeView,
  IngredientLike,
} from "@/app/(app)/recipes/[id]/components/cookingmode/types";
import { useEffect, useMemo, useState } from "react";
import { CookingModeBottomBar } from "@/app/(app)/recipes/[id]/components/cookingmode/cooking-mode-bottom-bar";
import { CookingModeHeader } from "@/app/(app)/recipes/[id]/components/cookingmode/cooking-mode-header";
import { resolveCookingModeSteps } from "@/app/(app)/recipes/[id]/components/cookingmode/cooking-mode-steps";
import { CookingStepView } from "@/app/(app)/recipes/[id]/components/cookingmode/cooking-step-view";
import { useIsDesktopCookingMode } from "@/app/(app)/recipes/[id]/components/cookingmode/use-is-desktop-cooking-mode";
import {
  useWakeLockContext,
  WakeLockProvider,
} from "@/app/(app)/recipes/[id]/components/wake-lock-context";
import { PublicSlugSmartInstruction } from "@/components/recipe/public-slug-smart-instruction";
import { ReadonlyIngredientsList } from "@/components/recipes/readonly-ingredients-list";
import { TimerDock } from "@/components/timer-dock";
import { HiddenItemsProvider } from "@/context/hidden-items-context";
import { FireIcon } from "@heroicons/react/24/outline";
import { useTranslations } from "next-intl";

import type { UnitsMap } from "@norish/config/zod/server-config";

type CookStep = {
  step: string;
  systemUsed: string;
  order: number;
  images?: { image: string | null; order: number }[];
};

/**
 * The public recipe page's cook mode.
 *
 * It renders the *same* header, step view AND bottom bar the in-app cooking
 * mode uses, so a recipe opened from discovery cooks and looks exactly like one
 * opened from the library — the centred step, the ingredients view, the kitchen
 * timers (Minútka + the step-timer dock) and the wake-lock toggle. The only
 * difference is the auth-free `PublicSlugSmartInstruction` injected into the
 * step view, plus a readonly ingredients list (the library's ingredients view
 * pulls authed servings/convert controls, which the public page has no
 * providers for).
 *
 * The bottom bar's utilities need two client contexts — wake lock and the
 * device Hidden-Items preference (behind the timer toggle) — so the dialog is
 * wrapped in both providers here (auth-free, default-empty), scoped to cooking
 * mode rather than the whole public page. `config.timersEnabled` is a public
 * procedure, so the timer controls resolve for signed-out cooks too.
 */
export function PublicCookMode({
  recipeId,
  recipeName,
  image,
  categories,
  steps,
  ingredients,
  units,
  systemUsed,
  totalMinutes,
}: {
  recipeId: string;
  recipeName: string;
  image?: string | null;
  categories?: string[];
  steps: CookStep[];
  ingredients?: IngredientLike[];
  units?: UnitsMap;
  systemUsed: string;
  totalMinutes?: number | null;
}) {
  const t = useTranslations("social.recipe");
  const [open, setOpen] = useState(false);

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

  if (cookSteps.length === 0) {
    return null;
  }

  return (
    <>
      <button
        className="bg-accent text-accent-foreground inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition hover:opacity-90"
        style={{ background: "var(--accent, #336640)", color: "#fff" }}
        type="button"
        onClick={() => setOpen(true)}
      >
        <FireIcon className="h-5 w-5" />
        <span>{t("cook")}</span>
      </button>

      {open ? (
        <WakeLockProvider>
          <HiddenItemsProvider>
            <PublicCookModeDialog
              cookSteps={cookSteps}
              ingredients={ingredients ?? []}
              recipe={recipe}
              systemUsed={systemUsed}
              totalMinutes={totalMinutes ?? null}
              units={units}
              onClose={() => setOpen(false)}
            />
          </HiddenItemsProvider>
        </WakeLockProvider>
      ) : null}
    </>
  );
}

function PublicCookModeDialog({
  recipe,
  cookSteps,
  ingredients,
  units,
  systemUsed,
  totalMinutes,
  onClose,
}: {
  recipe: CookingModeRecipe;
  cookSteps: ReturnType<typeof resolveCookingModeSteps>;
  ingredients: IngredientLike[];
  units?: UnitsMap;
  systemUsed: string;
  totalMinutes: number | null;
  onClose: () => void;
}) {
  const isDesktop = useIsDesktopCookingMode();
  const { enable, disable, isActive, isSupported } = useWakeLockContext();

  const [activeStep, setActiveStep] = useState(0);
  const [activeView, setActiveView] = useState<CookingModeView>("steps");
  const [areTimersOpen, setAreTimersOpen] = useState(false);
  // Fixed when the session begins: now + the recipe's total time. A projection,
  // never a promise — and absent for a recipe with no total time.
  const [readyAt] = useState<Date | null>(() =>
    totalMinutes && totalMinutes > 0 ? new Date(Date.now() + totalMinutes * 60_000) : null
  );

  // Hold the screen awake for the whole session; hand it back on close. The
  // bottom bar's toggle then only ever releases it (autoEnable is off there).
  useEffect(() => {
    if (isSupported && !isActive) {
      void enable();
    }

    return () => disable();
    // Mount = cook session start, unmount = close. Intentionally once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Escape closes; arrow keys page through steps and switch views.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowRight") {
        setActiveView("ingredients");
      } else if (e.key === "ArrowLeft") {
        setActiveView("steps");
      } else if (e.key === "ArrowDown") {
        setActiveView("steps");
        setActiveStep((v) => Math.min(cookSteps.length - 1, v + 1));
      } else if (e.key === "ArrowUp") {
        setActiveView("steps");
        setActiveStep((v) => Math.max(0, v - 1));
      }
    };

    window.addEventListener("keydown", onKey);

    return () => window.removeEventListener("keydown", onKey);
  }, [cookSteps.length, onClose]);

  return (
    <div
      aria-modal="true"
      className="bg-background/75 fixed inset-0 z-[1100] flex md:items-center md:justify-center md:p-8"
      role="dialog"
    >
      {/* Match the in-app cook mode: a centred card on desktop, fullscreen on
          phones. */}
      <div
        className={
          isDesktop
            ? "bg-surface shadow-overlay flex h-[min(92dvh,900px)] w-[min(1180px,calc(100vw-4rem))] flex-col overflow-hidden rounded-3xl"
            : "bg-background flex h-[100dvh] w-[100dvw] flex-col overflow-hidden"
        }
      >
        <CookingModeHeader recipe={recipe} onClose={onClose} />

        <div className="min-h-0 flex-1 overflow-hidden">
          {activeView === "ingredients" ? (
            <div className="h-full overflow-y-auto px-4 py-4 md:px-6">
              <ReadonlyIngredientsList
                interactive
                ingredients={ingredients}
                systemUsed={systemUsed}
                units={units}
              />
            </div>
          ) : (
            <CookingStepView
              InstructionComponent={PublicSlugSmartInstruction}
              activeStep={activeStep}
              displayIngredients={[]}
              recipe={recipe}
              steps={cookSteps}
            />
          )}
        </div>

        <CookingModeBottomBar
          activeStep={activeStep}
          activeView={activeView}
          areTimersOpen={areTimersOpen}
          readyAt={readyAt}
          steps={cookSteps}
          voiceEnabled={false}
          voiceListening={false}
          voiceSupported={false}
          onStepChange={setActiveStep}
          onTimersOpenChange={setAreTimersOpen}
          onToggleVoice={() => {}}
          onViewChange={setActiveView}
        />
      </div>

      <TimerDock
        className="z-[1150]"
        isExpanded={areTimersOpen}
        onExpandedChange={setAreTimersOpen}
      />
    </div>
  );
}
