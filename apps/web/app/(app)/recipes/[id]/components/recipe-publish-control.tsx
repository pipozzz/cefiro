"use client";

import { useState } from "react";
import { useTRPC } from "@/app/providers/trpc-provider";
import { showSafeErrorToast } from "@/lib/ui/safe-error-toast";
import { GlobeAltIcon, LinkIcon, LockClosedIcon } from "@heroicons/react/16/solid";
import { ArrowTopRightOnSquareIcon, ClipboardDocumentIcon } from "@heroicons/react/24/outline";
import { Button, Card, Spinner, toast } from "@heroui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

import type { RecipeVisibility } from "@norish/shared/contracts/zod";

type Props = {
  recipeId: string;
};

const VISIBILITIES: RecipeVisibility[] = ["private", "unlisted", "public"];

const VISIBILITY_ICON: Record<RecipeVisibility, typeof LockClosedIcon> = {
  private: LockClosedIcon,
  unlisted: LinkIcon,
  public: GlobeAltIcon,
};

export default function RecipePublishControl({ recipeId }: Props) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const t = useTranslations("social.recipeShare");
  const [copied, setCopied] = useState(false);

  const stateQuery = useQuery({
    ...trpc.social.getPublishState.queryOptions({ recipeId }),
    retry: false,
  });

  const setVisibilityMutation = useMutation(
    trpc.social.setVisibility.mutationOptions({
      onSuccess: (data) => {
        queryClient.setQueryData(trpc.social.getPublishState.queryKey({ recipeId }), () => ({
          visibility: data.visibility,
          slug: data.slug,
          publishedAt: data.publishedAt,
        }));
      },
      onError: (error) => {
        showSafeErrorToast(error, t("couldNotSave"));
      },
    })
  );

  const current = stateQuery.data?.visibility ?? "private";
  const slug = stateQuery.data?.slug ?? null;
  const publicUrl =
    slug && typeof window !== "undefined" ? `${window.location.origin}/r/${slug}` : null;

  const handleCopy = async () => {
    if (!publicUrl) {
      return;
    }

    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      toast.success(t("linkCopied"));
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard may be unavailable; ignore.
    }
  };

  const busy = setVisibilityMutation.isPending || stateQuery.isLoading;

  return (
    <Card className="bg-surface-secondary/40 border-border border">
      <Card.Content className="gap-3">
        <div className="flex items-center gap-2">
          <GlobeAltIcon className="text-primary h-5 w-5" />
          <h3 className="text-sm font-semibold">{t("heading")}</h3>
          {stateQuery.isLoading ? <Spinner size="sm" /> : null}
        </div>

        <p className="text-default-500 text-xs">{t("visibilityLabel")}</p>
        {/* Segmented control: a shared track with the selected option raised as a
            filled pill, so it reads as one switch with a current choice. */}
        <div
          role="radiogroup"
          aria-label={t("visibilityLabel")}
          className="border-default-200 bg-content2 flex w-full gap-1 rounded-full border p-1"
        >
          {VISIBILITIES.map((v) => {
            const Icon = VISIBILITY_ICON[v];
            const active = current === v;

            return (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={active}
                disabled={busy}
                onClick={() =>
                  current !== v && setVisibilityMutation.mutate({ recipeId, visibility: v })
                }
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition ${
                  active
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-default-600 hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{t(v)}</span>
              </button>
            );
          })}
        </div>
        <p className="text-default-500 text-xs">{t(`${current}Hint`)}</p>

        {current !== "private" && publicUrl ? (
          <div className="border-success/30 bg-success/10 rounded-2xl border p-3">
            <p className="mb-2 text-sm font-medium">{t("publicLink")}</p>
            <div className="flex items-center gap-2">
              <code className="bg-content2 flex-1 truncate rounded-lg px-2 py-1.5 text-xs">
                {publicUrl}
              </code>
              <Button size="sm" variant="tertiary" onPress={handleCopy} className="min-w-16">
                <ClipboardDocumentIcon className="h-4 w-4" />
                {copied ? t("copied") : t("copyLink")}
              </Button>
              <Button
                as="a"
                href={publicUrl}
                target="_blank"
                rel="noopener noreferrer"
                size="sm"
                variant="tertiary"
                className="min-w-16"
              >
                <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                {t("open")}
              </Button>
            </div>
          </div>
        ) : null}
      </Card.Content>
    </Card>
  );
}
