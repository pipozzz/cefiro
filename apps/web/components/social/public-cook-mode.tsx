"use client";

import { useEffect, useMemo, useState } from "react";
import { PublicSlugSmartInstruction } from "@/components/recipe/public-slug-smart-instruction";
import { ChevronDownIcon, ChevronUpIcon, FireIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { Button, Meter } from "@heroui/react";
import { useLocale, useTranslations } from "next-intl";

type CookStep = {
  step: string;
  systemUsed: string;
  order: number;
  images?: { image: string | null; order: number }[];
};

/**
 * A full-screen, one-step-at-a-time cooking view for the public recipe page.
 *
 * Deliberately self-contained: unlike the in-app CookingMode it depends on no
 * authenticated context (recipe/permissions/hidden-items providers). It mirrors
 * that in-app cook mode's chrome as closely as it can without those providers —
 * a name header, an accent progress meter, a "ready around" projection, and the
 * same bottom-bar navigation — so cooking a recipe feels the same whether it was
 * opened from the library or from discovery. It reuses the public, timer-aware
 * step renderer (PublicSlugSmartInstruction) so the "boil 10 min" chips work
 * here too, and keeps the screen awake while cooking.
 */
export function PublicCookMode({
  recipeId,
  recipeName,
  steps,
  systemUsed,
  totalMinutes,
}: {
  recipeId: string;
  recipeName: string;
  steps: CookStep[];
  systemUsed: string;
  totalMinutes?: number | null;
}) {
  const t = useTranslations("social.recipe");
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  // Fixed when the session begins: now + the recipe's total time. A projection,
  // never a promise — and absent for a recipe with no total time.
  const [readyAt, setReadyAt] = useState<Date | null>(null);

  // Only the steps written in the recipe's own measurement system, in order.
  const cookSteps = useMemo(
    () =>
      steps
        .filter((s) => s.systemUsed === systemUsed && s.step.trim().length > 0)
        .sort((a, b) => a.order - b.order),
    [steps, systemUsed]
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

  const current = cookSteps[index];
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
          className="bg-background fixed inset-0 z-[1100] flex flex-col"
          role="dialog"
        >
          {/* Header: recipe name + close */}
          <div className="border-border flex items-center gap-3 border-b px-4 py-3 md:px-6">
            <h2 className="text-foreground min-w-0 flex-1 truncate text-base font-semibold">
              {recipeName}
            </h2>
            <button
              aria-label={t("cookClose")}
              className="text-muted hover:text-foreground shrink-0 rounded-full p-1"
              type="button"
              onClick={() => setOpen(false)}
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-10">
            <div className="text-foreground mx-auto max-w-2xl text-xl leading-relaxed md:text-2xl">
              <PublicSlugSmartInstruction
                recipeId={recipeId}
                recipeName={recipeName}
                stepIndex={index}
                text={current.step}
              />
            </div>

            {current.images && current.images.length > 0 ? (
              <div className="mx-auto mt-6 flex max-w-2xl flex-wrap gap-3">
                {current.images.map((img, j) =>
                  img.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={j}
                      alt=""
                      className="h-40 w-40 rounded-2xl object-cover"
                      src={img.image}
                    />
                  ) : null
                )}
              </div>
            ) : null}
          </div>

          {/* Bottom bar mirrors the in-app cook mode: meter, ready-at + counter,
              then back / next. */}
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
      ) : null}
    </>
  );
}
