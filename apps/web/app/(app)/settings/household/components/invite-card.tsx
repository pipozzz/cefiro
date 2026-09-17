"use client";

import { useState } from "react";
import { useTRPC } from "@/app/providers/trpc-provider";
import { showSafeErrorToast } from "@/lib/ui/safe-error-toast";
import { EnvelopeIcon, TrashIcon } from "@heroicons/react/16/solid";
import { ClipboardDocumentIcon } from "@heroicons/react/24/outline";
import { Button, Card, Input, toast } from "@heroui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

import { useHouseholdSettingsContext } from "../context";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function InviteCard() {
  const t = useTranslations("settings.household.invite");
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { household, currentUserId } = useHouseholdSettingsContext();

  const [email, setEmail] = useState("");
  const [lastLink, setLastLink] = useState<string | null>(null);

  const invitesQuery = useQuery(trpc.households.listInvites.queryOptions());

  const invalidateInvites = () =>
    queryClient.invalidateQueries({ queryKey: trpc.households.listInvites.queryKey() });

  const inviteMutation = useMutation(
    trpc.households.inviteByEmail.mutationOptions({
      onSuccess: (data) => {
        setEmail("");
        setLastLink(data.link);
        void invalidateInvites();
        toast(data.emailed ? t("sent") : t("createdNoEmail"), { variant: "success" });
      },
      onError: (error) => showSafeErrorToast(error, t("couldNotInvite")),
    })
  );

  const revokeMutation = useMutation(
    trpc.households.revokeInvite.mutationOptions({
      onSuccess: () => void invalidateInvites(),
      onError: (error) => showSafeErrorToast(error, t("couldNotRevoke")),
    })
  );

  if (!household) {
    return null;
  }

  // Only the admin can invite (same guard as the join-code card).
  const currentUserData = currentUserId
    ? household.users.find((u) => u.id === currentUserId)
    : null;

  if (currentUserData?.isAdmin !== true) {
    return null;
  }

  const normalizedEmail = email.trim().toLowerCase();
  const canSend = EMAIL_RE.test(normalizedEmail) && !inviteMutation.isPending;
  const invites = invitesQuery.data?.invites ?? [];

  const copyLink = async () => {
    if (!lastLink) {
      return;
    }

    try {
      await navigator.clipboard.writeText(lastLink);
      toast(t("linkCopied"), { variant: "success" });
    } catch (error) {
      showSafeErrorToast(error, t("couldNotCopy"));
    }
  };

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

        <div className="flex gap-2">
          <Input
            variant="secondary"
            type="email"
            autoCapitalize="none"
            autoCorrect="off"
            placeholder={t("emailPlaceholder")}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && canSend) {
                inviteMutation.mutate({ email: normalizedEmail });
              }
            }}
          />
          <Button
            variant="primary"
            isDisabled={!canSend}
            isPending={inviteMutation.isPending}
            onPress={() => inviteMutation.mutate({ email: normalizedEmail })}
          >
            {t("sendButton")}
          </Button>
        </div>

        {lastLink ? (
          <div className="border-default-200 bg-content2 flex flex-col gap-2 rounded-xl border p-3">
            <span className="text-muted text-sm">{t("shareLinkHint")}</span>
            <div className="flex gap-2">
              <Input variant="secondary" isReadOnly className="text-sm" value={lastLink} />
              <Button isIconOnly aria-label={t("copyLink")} onPress={copyLink}>
                <ClipboardDocumentIcon className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : null}

        {invites.length > 0 ? (
          <div className="flex flex-col gap-2">
            <span className="text-muted text-sm font-medium">{t("pendingHeading")}</span>
            <ul className="flex flex-col gap-1">
              {invites.map((invite) => (
                <li
                  key={invite.id}
                  className="border-default-100 flex items-center justify-between gap-3 border-b py-2 text-sm last:border-b-0"
                >
                  <span className="text-foreground truncate">{invite.email}</span>
                  <Button
                    isIconOnly
                    size="sm"
                    variant="tertiary"
                    aria-label={t("revoke")}
                    isDisabled={revokeMutation.isPending}
                    onPress={() => revokeMutation.mutate({ inviteId: invite.id })}
                  >
                    <TrashIcon className="h-3.5 w-3.5" />
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </Card.Content>
    </Card>
  );
}
