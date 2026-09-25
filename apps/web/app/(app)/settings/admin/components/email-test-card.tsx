"use client";

import { useState } from "react";
import { useTRPC } from "@/app/providers/trpc-provider";
import { showSafeErrorToast } from "@/lib/ui/safe-error-toast";
import { EnvelopeIcon } from "@heroicons/react/24/outline";
import { Button, Card, Input, Label, toast } from "@heroui/react";
import { useMutation } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

/**
 * Admin: send a test email to confirm SMTP is configured and reachable, without
 * digging through server logs. Shows the outcome inline (delivered / not
 * configured / the SMTP error).
 */
export default function EmailTestCard() {
  const t = useTranslations("settings.admin.emailTest");
  const tErrors = useTranslations("common.errors");
  const trpc = useTRPC();
  const [to, setTo] = useState("");

  const sendTest = useMutation(
    trpc.admin.sendTestEmail.mutationOptions({
      onSuccess: (result) => {
        if (result.status === "sent") {
          toast.success(t("sent", { to }));
        } else if (result.status === "not_configured") {
          toast(t("notConfigured"), { variant: "warning" });
        } else {
          toast(t("failed", { error: result.message }), { variant: "danger" });
        }
      },
      onError: (error) => {
        showSafeErrorToast({
          title: t("error"),
          description: tErrors("technicalDetails"),
          color: "danger",
          error,
          context: "admin:test-email",
        });
      },
    })
  );

  const isValid = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to.trim());

  return (
    <Card>
      <Card.Header>
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <EnvelopeIcon className="h-5 w-5" />
          {t("title")}
        </h2>
      </Card.Header>
      <Card.Content className="gap-4">
        <p className="text-muted text-base">{t("description")}</p>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-56 flex-1">
            <Label>{t("toLabel")}</Label>
            <Input
              placeholder={t("toPlaceholder")}
              type="email"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
          <Button
            isDisabled={!isValid}
            isPending={sendTest.isPending}
            variant="tertiary"
            onPress={() => sendTest.mutate({ to: to.trim() })}
          >
            {t("send")}
          </Button>
        </div>
      </Card.Content>
    </Card>
  );
}
