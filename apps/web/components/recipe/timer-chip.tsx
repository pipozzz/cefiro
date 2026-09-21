"use client";

import React from "react";
import { useNotificationPermission } from "@/hooks/use-notification-permission";
import { useTimerStore } from "@/stores/timers";
import { ArrowPathIcon, ClockIcon, PauseIcon, PlayIcon } from "@heroicons/react/16/solid";
import { Chip } from "@heroui/react";

import { formatTimerMs } from "@norish/shared/lib/helpers";

interface TimerChipProps {
  id: string;
  recipeId: string;
  recipeName?: string;
  initialLabel: string;
  durationMs: number;
  originalText: string;
}

export function TimerChip({
  id,
  recipeId,
  recipeName,
  initialLabel,
  durationMs,
  originalText,
}: TimerChipProps) {
  const timer = useTimerStore((state) => state.timers.find((t) => t.id === id));
  const addTimer = useTimerStore((state) => state.addTimer);
  const startTimer = useTimerStore((state) => state.startTimer);
  const pauseTimer = useTimerStore((state) => state.pauseTimer);
  const resetTimer = useTimerStore((state) => state.resetTimer);
  const { requestPermission } = useNotificationPermission();

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!timer) {
      // Request notification permission on first timer interaction
      requestPermission();
      addTimer(id, recipeId, initialLabel, durationMs, recipeName);
      startTimer(id);
    } else if (timer.status === "running") {
      pauseTimer(id);
    } else if (timer.status === "paused") {
      startTimer(id);
    } else if (timer.status === "completed") {
      resetTimer(id);
    }
  };

  if (!timer) {
    return (
      <Chip
        as="button"
        className="mx-1 translate-y-[1px] rounded-full pr-1.5 pl-2.5 align-baseline text-base"
        color="default"
        type="button"
        variant="secondary"
        onClick={handleClick}
      >
        <ClockIcon className="h-4 w-4" />
        <Chip.Label>{originalText}</Chip.Label>
      </Chip>
    );
  }

  const isCompleted = timer.status === "completed";
  const isRunning = timer.status === "running";

  // Active timer - show as chip
  const icon = isCompleted ? (
    <ArrowPathIcon className="h-3 w-3" />
  ) : isRunning ? (
    <PauseIcon className="h-3 w-3" />
  ) : (
    <PlayIcon className="h-3 w-3" />
  );

  return (
    <Chip
      as="button"
      // A started timer switches to the solid `primary` variant (vs the quiet
      // `secondary` of a not-yet-started chip) so it clearly reads as "on":
      // running = solid accent, paused = amber, completed = red. The running
      // pill also pulses gently so an active countdown is obvious at a glance.
      className={`mx-1 translate-y-[1px] rounded-full pr-1.5 pl-2.5 align-baseline text-base ${
        isRunning ? "motion-safe:animate-pulse" : ""
      }`}
      color={isCompleted ? "danger" : isRunning ? "accent" : "warning"}
      size="md"
      type="button"
      variant="primary"
      onClick={handleClick}
    >
      {icon}
      <Chip.Label>{formatTimerMs(timer.remainingMs)}</Chip.Label>
    </Chip>
  );
}
