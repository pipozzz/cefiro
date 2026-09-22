"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { useTimersEnabledQuery } from "@/hooks/config";
import { useTimerStore } from "@/stores/timers";
import { ClockIcon } from "@heroicons/react/20/solid";
import { Button, Input, Popover } from "@heroui/react";
import { useTranslations } from "next-intl";

/** Preset durations, in minutes, a cook reaches for most often. */
const PRESET_MINUTES = [1, 3, 5, 10, 15, 20, 30, 45] as const;

const MAX_MINUTES = 600;

/**
 * A one-tap kitchen timer ("Minútka") launcher, reachable from anywhere in the
 * app chrome. Unlike the recipe step timers, this timer belongs to no recipe —
 * it is the plain egg-timer a cook wants while doing anything at all. It starts
 * a standalone timer in the shared timer store, so it surfaces in the same
 * floating dock, rings with the same sound, and raises the same notification as
 * every other timer; only its origin differs.
 */
export function QuickTimer({
  className,
  size = "sm",
  variant = "tertiary",
  icon,
  placement = "bottom",
}: {
  className?: string;
  size?: "sm" | "md";
  variant?: "tertiary" | "secondary";
  /** Trigger glyph; defaults to a clock. Cook mode passes its own so the
   * "start a timer" button reads distinctly from the "view timers" one. */
  icon?: ReactNode;
  placement?: "bottom" | "top";
}) {
  const t = useTranslations("common.timer");
  const { timersEnabled } = useTimersEnabledQuery();
  const addStandaloneTimer = useTimerStore((state) => state.addStandaloneTimer);
  const [open, setOpen] = useState(false);
  const [customMinutes, setCustomMinutes] = useState("");

  // Timers turned off (by the administrator or the reader) means no launcher.
  if (timersEnabled === false) {
    return null;
  }

  const start = (minutes: number) => {
    const clamped = Math.min(MAX_MINUTES, Math.max(1, Math.round(minutes)));

    // The dock shows this label; "N min" reads the same in every locale we ship.
    addStandaloneTimer(`${clamped} min`, clamped * 60_000);
    setCustomMinutes("");
    setOpen(false);
  };

  const customValue = Number.parseInt(customMinutes, 10);
  const customValid = Number.isFinite(customValue) && customValue >= 1;

  return (
    <Popover isOpen={open} onOpenChange={setOpen}>
      <Popover.Trigger>
        <Button
          isIconOnly
          aria-label={t("quickAria")}
          className={`rounded-full ${className ?? ""}`}
          size={size}
          variant={variant}
        >
          {icon ?? <ClockIcon className="h-5 w-5" />}
        </Button>
      </Popover.Trigger>
      {/* z above the fullscreen cook-mode dialog (z-[1100]) so it is usable there. */}
      <Popover.Content className="z-[1200] w-64" placement={placement}>
        <Popover.Arrow />
        <Popover.Dialog>
          <div className="p-1">
            <p className="text-foreground mb-3 text-sm font-semibold">{t("quickTitle")}</p>

            <div className="grid grid-cols-4 gap-2">
              {PRESET_MINUTES.map((minutes) => (
                <Button
                  key={minutes}
                  className="rounded-xl font-medium tabular-nums"
                  size="sm"
                  variant="secondary"
                  onPress={() => start(minutes)}
                >
                  {minutes}
                </Button>
              ))}
            </div>

            <p className="text-muted mt-2 text-center text-xs">{t("quickMinutesHint")}</p>

            <form
              className="mt-3 flex items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (customValid) {
                  start(customValue);
                }
              }}
            >
              <Input
                aria-label={t("quickCustom")}
                className="flex-1"
                inputMode="numeric"
                max={MAX_MINUTES}
                min={1}
                placeholder={t("quickCustom")}
                type="number"
                value={customMinutes}
                variant="primary"
                onChange={(e) => setCustomMinutes(e.target.value)}
              />
              <Button
                className="rounded-full"
                isDisabled={!customValid}
                size="sm"
                type="submit"
                variant="primary"
              >
                {t("quickStart")}
              </Button>
            </form>
          </div>
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  );
}

export default QuickTimer;
