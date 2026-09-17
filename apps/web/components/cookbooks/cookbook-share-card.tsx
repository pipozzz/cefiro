"use client";

import { useEffect, useState } from "react";
import { useTRPC } from "@/app/providers/trpc-provider";
import { showSafeErrorToast } from "@/lib/ui/safe-error-toast";
import { GlobeAltIcon, LinkIcon as LinkIconMini, LockClosedIcon } from "@heroicons/react/16/solid";
import { ArrowTopRightOnSquareIcon, LinkIcon } from "@heroicons/react/24/outline";
import { Button, toast } from "@heroui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

type Visibility = "private" | "unlisted" | "public";

const VISIBILITIES: Visibility[] = ["private", "unlisted", "public"];

const VISIBILITY_ICON: Record<Visibility, typeof LockClosedIcon> = {
  private: LockClosedIcon,
  unlisted: LinkIconMini,
  public: GlobeAltIcon,
};

export function CookbookShareCard({ cookbookId }: { cookbookId: string }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const t = useTranslations("social.cookbookShare");

  const stateQuery = useQuery({
    ...trpc.social.getCookbookPublishState.queryOptions({ cookbookId }),
    retry: false,
  });

  const [description, setDescription] = useState("");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (stateQuery.data && !hydrated) {
      setDescription(stateQuery.data.description ?? "");
      setHydrated(true);
    }
  }, [stateQuery.data, hydrated]);

  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: trpc.social.getCookbookPublishState.queryKey({ cookbookId }),
    });

  const setVisibility = useMutation(
    trpc.social.setCookbookVisibility.mutationOptions({
      onSuccess: () => {
        toast.success(t("saved"));
        invalidate();
      },
      onError: (error) => showSafeErrorToast(error, t("couldNotSave")),
    })
  );

  const saveDescription = useMutation(
    trpc.social.setCookbookDescription.mutationOptions({
      onSuccess: invalidate,
      onError: (error) => showSafeErrorToast(error, t("couldNotSave")),
    })
  );

  if (stateQuery.isError || !stateQuery.data) {
    return null;
  }

  const { visibility, slug } = stateQuery.data;
  const isShared = visibility !== "private";
  const publicUrl = slug ? `${window.location.origin}/c/${slug}` : null;

  const onCopy = async () => {
    if (!publicUrl) return;

    try {
      await navigator.clipboard.writeText(publicUrl);
      toast.success(t("linkCopied"));
    } catch {
      // Clipboard can be unavailable (permissions, insecure context) — ignore.
    }
  };

  return (
    <div className="flex flex-col">
      <p className="text-default-500 mb-2 text-xs">{t("visibilityLabel")}</p>
      {/* Segmented control: a shared track with the selected option raised as a
          filled pill, so it reads as one switch with a current choice. */}
      <div
        role="radiogroup"
        aria-label={t("visibilityLabel")}
        className="border-default-200 bg-content2 flex w-full gap-1 rounded-full border p-1"
      >
        {VISIBILITIES.map((v) => {
          const Icon = VISIBILITY_ICON[v];
          const active = visibility === v;

          return (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={active}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition ${
                active
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-default-600 hover:text-foreground"
              }`}
              disabled={setVisibility.isPending}
              onClick={() =>
                visibility !== v && setVisibility.mutate({ cookbookId, visibility: v })
              }
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{t(v)}</span>
            </button>
          );
        })}
      </div>
      <p className="text-default-500 mt-2 text-xs">{t(`${visibility}Hint`)}</p>

      {isShared ? (
        <>
          <div className="mt-4">
            <label className="text-default-600 mb-1 block text-xs font-medium">
              {t("descriptionLabel")}
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={() => {
                const next = description.trim() || null;

                if (next !== (stateQuery.data?.description ?? null)) {
                  saveDescription.mutate({ cookbookId, description: next });
                }
              }}
              rows={2}
              maxLength={500}
              placeholder={t("descriptionPlaceholder")}
              className="border-default-200 bg-content1 text-foreground focus:border-primary w-full rounded-xl border px-3 py-2 text-sm outline-none"
            />
          </div>

          {publicUrl ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button
                as="a"
                href={`/c/${slug}`}
                target="_blank"
                rel="noopener noreferrer"
                variant="tertiary"
                size="sm"
              >
                <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                {t("viewPublic")}
              </Button>
              <Button variant="tertiary" size="sm" onPress={onCopy}>
                <LinkIcon className="h-4 w-4" />
                {t("copyLink")}
              </Button>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
