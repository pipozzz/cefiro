"use client";

import { useState } from "react";
import { useTRPC } from "@/app/providers/trpc-provider";
import { showSafeErrorToast } from "@/lib/ui/safe-error-toast";
import { EnvelopeIcon, TrashIcon, UserPlusIcon } from "@heroicons/react/24/outline";
import { Button, Card, InputGroup, Label, Spinner, TextField, toast } from "@heroui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

/**
 * Admin card: invite people to register on this instance even while public
 * signup is locked. Each invite is a single-use, email-bound link (emailed when
 * SMTP is configured, always copyable). The invitee creates their own account —
 * no household is involved.
 */
export default function InstanceInvitesCard() {
  const t = useTranslations("settings.admin.instanceInvites");
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const [email, setEmail] = useState("");
  const [lastLink, setLastLink] = useState<string | null>(null);

  const listQuery = useQuery(trpc.admin.instanceInvites.list.queryOptions());
  const listKey = trpc.admin.instanceInvites.list.queryKey();

  const create = useMutation(
    trpc.admin.instanceInvites.create.mutationOptions({
      onSuccess: (data) => {
        setLastLink(data.link);
        setEmail("");
        toast(data.emailed ? t("emailedNote") : t("notEmailedNote"), {
          variant: "success",
        });
        void queryClient.invalidateQueries({ queryKey: listKey });
      },
      onError: (error) =>
        showSafeErrorToast({
          title: t("createError"),
          error,
          color: "danger",
          context: "admin:instance-invite-create",
        }),
    })
  );

  const revoke = useMutation(
    trpc.admin.instanceInvites.revoke.mutationOptions({
      onSuccess: () => {
        toast(t("revoked"), { variant: "success" });
        void queryClient.invalidateQueries({ queryKey: listKey });
      },
      onError: (error) =>
        showSafeErrorToast({
          title: t("revokeError"),
          error,
          color: "danger",
          context: "admin:instance-invite-revoke",
        }),
    })
  );

  const invites = listQuery.data?.invites ?? [];
  const emailValid = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim());

  const copyLink = async () => {
    if (!lastLink) {
      return;
    }

    try {
      await navigator.clipboard.writeText(lastLink);
      toast(t("copied"), { variant: "success" });
    } catch {
      // Clipboard blocked (insecure context / permissions): the link stays
      // visible for manual copy, so this is non-fatal.
    }
  };

  return (
    <Card>
      <Card.Header>
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <UserPlusIcon className="h-5 w-5" />
          {t("title")}
        </h2>
      </Card.Header>
      <Card.Content className="flex flex-col gap-5">
        <p className="text-default-500 text-sm">{t("description")}</p>

        <form
          className="flex flex-col gap-3 sm:flex-row sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();

            if (emailValid) {
              create.mutate({ email: email.trim() });
            }
          }}
        >
          <TextField
            className="flex-1"
            name="invite-email"
            type="email"
            value={email}
            onChange={setEmail}
          >
            <Label>{t("emailLabel")}</Label>
            <InputGroup fullWidth>
              <InputGroup.Addon>
                <EnvelopeIcon className="h-4 w-4" />
              </InputGroup.Addon>
              <InputGroup.Input autoComplete="off" placeholder={t("emailPlaceholder")} />
            </InputGroup>
          </TextField>
          <Button
            type="submit"
            variant="primary"
            isDisabled={!emailValid}
            isPending={create.isPending}
          >
            {t("sendButton")}
          </Button>
        </form>

        {lastLink ? (
          <div className="bg-content2 flex flex-col gap-2 rounded-xl p-3">
            <span className="text-default-500 text-xs font-medium">{t("linkCreated")}</span>
            <div className="flex items-center gap-2">
              <code className="text-foreground min-w-0 flex-1 truncate text-xs">{lastLink}</code>
              <Button size="sm" variant="secondary" onPress={copyLink}>
                {t("copyLink")}
              </Button>
            </div>
          </div>
        ) : null}

        <div className="flex flex-col gap-2">
          <span className="text-default-500 text-sm font-medium">{t("pendingTitle")}</span>
          {listQuery.isLoading ? (
            <Spinner size="sm" />
          ) : invites.length === 0 ? (
            <p className="text-default-400 text-sm">{t("noPending")}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {invites.map((invite) => (
                <li
                  key={invite.id}
                  className="bg-content2 flex items-center justify-between gap-3 rounded-xl px-3 py-2"
                >
                  <div className="flex min-w-0 flex-col">
                    <span className="text-foreground truncate text-sm font-medium">
                      {invite.email}
                    </span>
                    <span className="text-default-400 text-xs">
                      {t("expiresOn", {
                        date: new Date(invite.expiresAt).toLocaleDateString(),
                      })}
                    </span>
                  </div>
                  <Button
                    isIconOnly
                    aria-label={t("revoke")}
                    size="sm"
                    variant="tertiary"
                    isDisabled={revoke.isPending}
                    onPress={() => revoke.mutate({ inviteId: invite.id })}
                  >
                    <TrashIcon className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card.Content>
    </Card>
  );
}
