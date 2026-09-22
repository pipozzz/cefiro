"use client";

import { useTRPC } from "@/app/providers/trpc-provider";
import { CalendarDaysIcon } from "@heroicons/react/16/solid";
import { Button, toast } from "@heroui/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

import { dateKey } from "@norish/shared/lib/helpers";

/** Monday–Sunday of the current week, as plain YYYY-MM-DD strings. */
function currentWeekRange(): { from: string; to: string } {
  const now = new Date();
  const mondayOffset = (now.getDay() + 6) % 7; // Sun=6 … Mon=0
  const monday = new Date(now);

  monday.setDate(now.getDate() - mondayOffset);

  const sunday = new Date(monday);

  sunday.setDate(monday.getDate() + 6);

  return { from: dateKey(monday), to: dateKey(sunday) };
}

/**
 * One tap turns this week's meal plan into a shopping list: the server sums the
 * ingredients of every planned recipe and merges them into the groceries. Sits
 * in the groceries header next to "Add".
 */
export default function GenerateFromPlanButton() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const t = useTranslations("groceries.page");

  const mutation = useMutation(
    trpc.groceries.generateFromPlan.mutationOptions({
      onSuccess: (result) => {
        queryClient.invalidateQueries({ queryKey: trpc.groceries.list.queryKey() });

        toast(
          result.added > 0
            ? t("generatedFromPlan", { count: result.added, recipes: result.recipeCount })
            : t("noPlanThisWeek")
        );
      },
    })
  );

  return (
    <Button
      className="rounded-full font-medium"
      isPending={mutation.isPending}
      size="sm"
      startContent={<CalendarDaysIcon className="h-4 w-4" />}
      variant="tertiary"
      onPress={() => mutation.mutate(currentWeekRange())}
    >
      {t("fromPlan")}
    </Button>
  );
}
