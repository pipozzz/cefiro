"use client";

import { useEffect, useState } from "react";
import { useTRPC } from "@/app/providers/trpc-provider";
import { showSafeErrorToast } from "@/lib/ui/safe-error-toast";
import { ArrowTopRightOnSquareIcon, LinkIcon } from "@heroicons/react/24/outline";
import { Button, toast } from "@heroui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

type Visibility = "private" | "unlisted" | "public";

const VISIBILITIES: Visibility[] = ["private", "unlisted", "public"];

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

  const pill = (active: boolean) =>
    `rounded-full px-4 py-1.5 text-sm font-medium transition ${
      active ? "bg-primary text-primary-foreground" : "bg-content2 text-default-600 hover:bg-content3"
    }`;

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
    <div className="rounded-2xl bg-content1 p-4 ring-1 ring-default-100">
      <h2 className="mb-3 text-sm font-semibold text-foreground">{t("heading")}</h2>

      <p className="mb-2 text-xs text-default-500">{t("visibilityLabel")}</p>
      <div className="flex flex-wrap gap-2">
        {VISIBILITIES.map((v) => (
          <button
            key={v}
            type="button"
            className={pill(visibility === v)}
            disabled={setVisibility.isPending}
            onClick={() => visibility !== v && setVisibility.mutate({ cookbookId, visibility: v })}
          >
            {t(v)}
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs text-default-500">{t(`${visibility}Hint`)}</p>

      {isShared ? (
        <>
          <div className="mt-4">
            <label className="mb-1 block text-xs font-medium text-default-600">
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
              className="w-full rounded-xl border border-default-200 bg-content1 px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
            />
          </div>

          {publicUrl ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button as="a" href={`/c/${slug}`} target="_blank" rel="noopener noreferrer" variant="tertiary" size="sm">
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
