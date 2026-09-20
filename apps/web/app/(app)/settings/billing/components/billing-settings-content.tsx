"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTRPC } from "@/app/providers/trpc-provider";
import SettingsSkeleton from "@/components/skeleton/settings-skeleton";
import { showSafeErrorToast } from "@/lib/ui/safe-error-toast";
import { CheckIcon, SparklesIcon } from "@heroicons/react/24/outline";
import { Button, Progress } from "@heroui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

import type { Entitlements, PaidPlanId, PlanId } from "@norish/shared/lib/plans";
import { PAID_PLAN_IDS, PLAN_IDS, PLANS } from "@norish/shared/lib/plans";

/** The bullet list for a plan, derived from its entitlements so the marketing
 * copy can never drift from what the plan actually grants. Boolean perks only
 * appear when granted; the two metered limits always show their number. */
function planFeatures(entitlements: Entitlements, t: ReturnType<typeof useTranslations>): string[] {
  const features: string[] = [];

  features.push(
    entitlements.maxHouseholdMembers === Number.POSITIVE_INFINITY
      ? t("billing.features.householdMembersUnlimited")
      : t("billing.features.householdMembers", { count: entitlements.maxHouseholdMembers })
  );
  features.push(
    entitlements.aiCreditsPerMonth === Number.POSITIVE_INFINITY
      ? t("billing.features.aiCreditsUnlimited")
      : t("billing.features.aiCredits", { count: entitlements.aiCreditsPerMonth })
  );

  if (entitlements.aiImageGeneration) {
    features.push(t("billing.features.aiImageGeneration"));
  }

  if (entitlements.caldavSync) {
    features.push(t("billing.features.caldavSync"));
  }

  return features;
}

function PlanCard({
  plan,
  isCurrent,
  onChoose,
  isBusy,
}: {
  plan: PlanId;
  isCurrent: boolean;
  onChoose: (() => void) | null;
  isBusy: boolean;
}) {
  const t = useTranslations("settings");
  const entitlements = PLANS[plan].entitlements;
  const isPaid = (PAID_PLAN_IDS as readonly string[]).includes(plan);

  return (
    <div
      className={`flex flex-col rounded-2xl border p-5 ${
        isCurrent ? "border-primary ring-primary/30 ring-2" : "border-default-200"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-lg font-semibold">{t(`billing.planName.${plan}`)}</h3>
        {isCurrent ? (
          <span className="bg-primary/15 text-primary rounded-full px-2 py-0.5 text-xs font-medium">
            {t("billing.currentBadge")}
          </span>
        ) : null}
      </div>

      <div className="mt-2 flex items-baseline gap-1">
        <span className="text-2xl font-bold">{t(`billing.price.${plan}`)}</span>
        {isPaid ? (
          <span className="text-default-500 text-sm">{t("billing.price.perMonth")}</span>
        ) : null}
      </div>

      <p className="text-default-500 mt-1 text-sm">{t(`billing.tagline.${plan}`)}</p>

      <ul className="mt-4 flex flex-1 flex-col gap-2">
        {planFeatures(entitlements, t).map((feature) => (
          <li key={feature} className="flex items-start gap-2 text-sm">
            <CheckIcon className="text-primary mt-0.5 h-4 w-4 shrink-0" />
            <span className="text-default-700">{feature}</span>
          </li>
        ))}
      </ul>

      <div className="mt-5">
        {isCurrent ? (
          <Button isDisabled className="w-full" variant="tertiary">
            {t("billing.cta.current")}
          </Button>
        ) : onChoose ? (
          <Button className="w-full" isLoading={isBusy} variant="primary" onPress={onChoose}>
            {t("billing.cta.upgrade")}
          </Button>
        ) : (
          <div aria-hidden className="h-10" />
        )}
      </div>
    </div>
  );
}

/**
 * How much of the caller's monthly AI-action allowance is spent. Shown only on
 * metered (billing-enabled, non-unlimited) plans; the bar warns amber as the
 * cap nears and turns red once it is reached, with a nudge toward upgrading.
 */
function AiUsageMeter({ used, limit }: { used: number; limit: number }) {
  const t = useTranslations("settings");
  const remaining = Math.max(0, limit - used);
  const ratio = limit > 0 ? used / limit : 1;
  const atLimit = remaining === 0;
  const color = atLimit ? "danger" : ratio >= 0.8 ? "warning" : "primary";

  return (
    <div className="border-default-200 flex flex-col gap-3 rounded-2xl border p-5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <SparklesIcon className="text-primary h-5 w-5" />
          <h3 className="font-semibold">{t("billing.usage.title")}</h3>
        </div>
        <span className="text-default-500 text-sm tabular-nums">
          {used} / {limit}
        </span>
      </div>

      <Progress
        aria-label={t("billing.usage.title")}
        color={color}
        maxValue={limit}
        value={used}
      />

      <p className="text-default-500 text-sm">
        {atLimit
          ? t("billing.usage.atLimit")
          : t("billing.usage.remaining", { count: remaining })}
      </p>
    </div>
  );
}

export default function BillingSettingsContent() {
  const trpc = useTRPC();
  const t = useTranslations("settings");
  const queryClient = useQueryClient();
  const router = useRouter();
  const searchParams = useSearchParams();

  const { data, isLoading } = useQuery(trpc.billing.getMyEntitlements.queryOptions());
  const usage = useQuery(trpc.billing.getMyAiUsage.queryOptions());

  const checkout = useMutation(
    trpc.billing.createCheckoutSession.mutationOptions({
      onSuccess: ({ url }) => {
        window.location.href = url;
      },
      onError: (error) =>
        showSafeErrorToast({
          title: t("billing.errors.title"),
          description: t("billing.errors.generic"),
          error,
          context: "billing.createCheckoutSession",
        }),
    })
  );

  const portal = useMutation(
    trpc.billing.createPortalSession.mutationOptions({
      onSuccess: ({ url }) => {
        window.location.href = url;
      },
      onError: (error) =>
        showSafeErrorToast({
          title: t("billing.errors.title"),
          description: t("billing.errors.generic"),
          error,
          context: "billing.createPortalSession",
        }),
    })
  );

  // Stripe returns the user to `?billing=success|cancel`; surface the outcome,
  // refresh the resolved plan, then strip the param so a reload doesn't repeat
  // the toast.
  const billingResult = searchParams.get("billing");

  useEffect(() => {
    if (billingResult !== "success" && billingResult !== "cancel") {
      return;
    }

    if (billingResult === "success") {
      void queryClient.invalidateQueries({
        queryKey: trpc.billing.getMyEntitlements.queryKey(),
      });
      // The new plan has a different AI allowance, so refresh the meter too.
      void queryClient.invalidateQueries({
        queryKey: trpc.billing.getMyAiUsage.queryKey(),
      });
      showSafeErrorToast({
        title: t("billing.status.successTitle"),
        description: t("billing.status.success"),
        color: "success",
      });
    } else {
      showSafeErrorToast({
        title: t("billing.status.cancelTitle"),
        description: t("billing.status.cancel"),
        color: "warning",
      });
    }

    router.replace("/settings?tab=billing");
    // Run once per redirect result; the deps below are stable references.
  }, [
    billingResult,
    queryClient,
    router,
    t,
    trpc.billing.getMyEntitlements,
    trpc.billing.getMyAiUsage,
  ]);

  if (isLoading || !data) {
    return <SettingsSkeleton />;
  }

  // A self-hosted instance with billing off grants everyone everything, so
  // there is nothing to sell — explain the unlimited access instead.
  if (!data.billingEnabled) {
    return (
      <div className="border-default-200 flex w-full flex-col items-start gap-2 rounded-2xl border p-6">
        <div className="flex items-center gap-2">
          <SparklesIcon className="text-primary h-5 w-5" />
          <h2 className="text-lg font-semibold">{t("billing.selfHosted.title")}</h2>
        </div>
        <p className="text-default-500 text-sm">{t("billing.selfHosted.body")}</p>
      </div>
    );
  }

  const currentPlan = data.planId;
  const isPaidCurrent = (PAID_PLAN_IDS as readonly string[]).includes(currentPlan);
  const busyPlan = checkout.isPending ? checkout.variables?.plan : undefined;

  return (
    <div className="flex w-full flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">{t("billing.title")}</h2>
          <p className="text-default-500 text-sm">
            {t("billing.currentPlan", { plan: t(`billing.planName.${currentPlan}`) })}
          </p>
        </div>
        {isPaidCurrent ? (
          <Button isLoading={portal.isPending} variant="outline" onPress={() => portal.mutate()}>
            {t("billing.cta.manage")}
          </Button>
        ) : null}
      </div>

      {usage.data && usage.data.limit !== null ? (
        <AiUsageMeter limit={usage.data.limit} used={usage.data.used} />
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {PLAN_IDS.map((plan) => {
          const isCurrent = plan === currentPlan;
          const isPaidPlan = (PAID_PLAN_IDS as readonly string[]).includes(plan);
          // Paid plans you are not on can be chosen via Checkout; the free plan
          // is reached by downgrading through the billing portal, not here.
          const onChoose =
            !isCurrent && isPaidPlan ? () => checkout.mutate({ plan: plan as PaidPlanId }) : null;

          return (
            <PlanCard
              key={plan}
              isBusy={busyPlan === plan}
              isCurrent={isCurrent}
              plan={plan}
              onChoose={onChoose}
            />
          );
        })}
      </div>

      <p className="text-default-400 text-xs">{t("billing.taxNote")}</p>
    </div>
  );
}
