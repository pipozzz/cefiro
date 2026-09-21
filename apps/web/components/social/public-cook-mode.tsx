"use client";

import { useEffect, useMemo, useState } from "react";
import { PublicSlugSmartInstruction } from "@/components/recipe/public-slug-smart-instruction";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  FireIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { Button } from "@heroui/react";
import { useTranslations } from "next-intl";

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
 * authenticated context (recipe/permissions/hidden-items providers). It reuses
 * the public, timer-aware step renderer (PublicSlugSmartInstruction) so the
 * "boil 10 min" chips work here too — the recipe view mounts the TimerTicker
 * that drives them — and keeps the screen awake while cooking.
 */
export function PublicCookMode({
  recipeId,
  recipeName,
  steps,
  systemUsed,
}: {
  recipeId: string;
  recipeName: string;
  steps: CookStep[];
  systemUsed: string;
}) {
  const t = useTranslations("social.recipe");
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);

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
      else if (e.key === "ArrowRight") setIndex((v) => Math.min(cookSteps.length - 1, v + 1));
      else if (e.key === "ArrowLeft") setIndex((v) => Math.max(0, v - 1));
    };

    window.addEventListener("keydown", onKey);

    return () => window.removeEventListener("keydown", onKey);
  }, [open, cookSteps.length]);

  if (cookSteps.length === 0) {
    return null;
  }

  const current = cookSteps[index];
  const isLast = index === cookSteps.length - 1;

  return (
    <>
      <button
        className="bg-accent text-accent-foreground inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition hover:opacity-90"
        style={{ background: "var(--accent, #336640)", color: "#fff" }}
        type="button"
        onClick={() => {
          setIndex(0);
          setOpen(true);
        }}
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
          <div className="border-default-100 flex items-center gap-3 border-b px-4 py-3">
            <span className="text-default-500 shrink-0 text-sm tabular-nums">
              {t("cookStep", { current: index + 1, total: cookSteps.length })}
            </span>
            <div className="bg-content2 h-1.5 flex-1 overflow-hidden rounded-full">
              <div
                className="bg-primary h-full rounded-full transition-all"
                style={{ width: `${((index + 1) / cookSteps.length) * 100}%` }}
              />
            </div>
            <button
              aria-label={t("cookClose")}
              className="text-default-500 hover:text-foreground shrink-0 rounded-full p-1"
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

          <div className="border-default-100 flex items-center justify-between gap-3 border-t px-4 py-3">
            <Button
              isDisabled={index === 0}
              variant="tertiary"
              onPress={() => setIndex((v) => Math.max(0, v - 1))}
            >
              <ChevronLeftIcon className="h-4 w-4" />
              {t("cookPrev")}
            </Button>
            {isLast ? (
              <Button variant="primary" onPress={() => setOpen(false)}>
                {t("cookDone")}
              </Button>
            ) : (
              <Button variant="primary" onPress={() => setIndex((v) => v + 1)}>
                {t("cookNext")}
                <ChevronRightIcon className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
