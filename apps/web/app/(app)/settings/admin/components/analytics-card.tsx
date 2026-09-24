"use client";

import { useEffect, useRef, useState } from "react";
import { useTRPC } from "@/app/providers/trpc-provider";
import { showSafeErrorToast } from "@/lib/ui/safe-error-toast";
import { ChartBarIcon } from "@heroicons/react/24/outline";
import { Button, Card, Input, Label, TextField, toast } from "@heroui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

/**
 * Admin card for Plausible analytics. Writes the DB `analytics_config`, which
 * the root <Analytics> reads (env is the fallback). Setting a domain turns it
 * on; clearing it turns it off (unless an env var still provides one).
 */
export default function AnalyticsCard() {
  const t = useTranslations("settings.admin.analytics");
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const { data } = useQuery(trpc.admin.getAnalytics.queryOptions());

  const [domain, setDomain] = useState("");
  const [src, setSrc] = useState("");
  const initialized = useRef(false);

  useEffect(() => {
    if (data && !initialized.current) {
      initialized.current = true;
      setDomain(data.plausibleDomain);
      setSrc(data.plausibleSrc);
    }
  }, [data]);

  const save = useMutation(
    trpc.admin.updateAnalytics.mutationOptions({
      onSuccess: () => {
        toast(t("saved"), { variant: "success" });
        void queryClient.invalidateQueries({ queryKey: trpc.admin.getAnalytics.queryKey() });
      },
      onError: (error) =>
        showSafeErrorToast({
          title: t("saveError"),
          error,
          color: "danger",
          context: "admin:analytics",
        }),
    })
  );

  return (
    <Card>
      <Card.Header>
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <ChartBarIcon className="h-5 w-5" />
          {t("title")}
        </h2>
      </Card.Header>
      <Card.Content className="flex flex-col gap-4">
        <p className="text-default-500 text-sm">{t("description")}</p>

        <TextField value={domain} onChange={setDomain}>
          <Label>{t("domainLabel")}</Label>
          <Input fullWidth placeholder={t("domainPlaceholder")} variant="secondary" />
        </TextField>

        <TextField value={src} onChange={setSrc}>
          <Label>{t("srcLabel")}</Label>
          <Input fullWidth placeholder={t("srcPlaceholder")} variant="secondary" />
          <p className="text-default-400 mt-1 text-xs">{t("srcHint")}</p>
        </TextField>

        <div className="flex justify-end">
          <Button
            isPending={save.isPending}
            variant="primary"
            onPress={() => save.mutate({ plausibleDomain: domain, plausibleSrc: src })}
          >
            {t("save")}
          </Button>
        </div>
      </Card.Content>
    </Card>
  );
}
