"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTRPC } from "@/app/providers/trpc-provider";
import { showSafeErrorToast } from "@/lib/ui/safe-error-toast";
import { Button, Card, Spinner } from "@heroui/react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

export default function HouseholdJoinPage() {
  const t = useTranslations("settings.household.joinPage");
  const trpc = useTRPC();
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const inviteQuery = useQuery({
    ...trpc.households.getInvite.queryOptions({ token }),
    enabled: token.length > 0,
    retry: false,
  });

  const acceptMutation = useMutation(
    trpc.households.acceptInvite.mutationOptions({
      onSuccess: () => router.replace("/settings/household"),
      onError: (error) => showSafeErrorToast(error, t("couldNotJoin")),
    })
  );

  const invite = inviteQuery.data?.invite ?? null;
  const isInvalid = !token || (inviteQuery.isSuccess && !invite);

  return (
    <div className="mx-auto max-w-lg px-4 py-10 md:py-16">
      <Card>
        <Card.Content className="items-center gap-5 py-10 text-center">
          {token && inviteQuery.isLoading ? (
            <Spinner />
          ) : isInvalid ? (
            <>
              <h1 className="text-foreground text-xl font-bold">{t("invalidTitle")}</h1>
              <p className="text-muted">{t("invalidBody")}</p>
              <Button variant="tertiary" onPress={() => router.replace("/settings/household")}>
                {t("goToHousehold")}
              </Button>
            </>
          ) : invite ? (
            <>
              <h1 className="text-foreground text-2xl font-bold">
                {t("title", { household: invite.householdName })}
              </h1>
              <p className="text-muted">{t("body")}</p>
              <Button
                variant="primary"
                isPending={acceptMutation.isPending}
                onPress={() => acceptMutation.mutate({ token })}
              >
                {t("acceptButton")}
              </Button>
            </>
          ) : null}
        </Card.Content>
      </Card>
    </div>
  );
}
