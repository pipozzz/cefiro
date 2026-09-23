"use client";

import { useState } from "react";
import { useTRPC } from "@/app/providers/trpc-provider";
import { showSafeErrorToast } from "@/lib/ui/safe-error-toast";
import { GlobeAltIcon, LinkIcon, XMarkIcon } from "@heroicons/react/16/solid";
import { Button, toast } from "@heroui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

const DISMISS_KEY = "cefiro:publish-nudge-dismissed";

function readDismissed(): string[] {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);

    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function rememberDismiss(recipeId: string): void {
  try {
    const list = readDismissed();

    if (!list.includes(recipeId)) {
      // Cap the list so a heavy user's dismissals never grow unbounded.
      localStorage.setItem(DISMISS_KEY, JSON.stringify([...list, recipeId].slice(-300)));
    }
  } catch {
    // Storage unavailable (private window, blocked) — the nudge just reappears.
  }
}

/**
 * A gentle prompt on the owner's own *private* recipe to make it public, so more
 * recipes reach discovery and search — the supply side of growing the site.
 *
 * Opt-in by design: it never auto-publishes (an imported recipe may be someone
 * else's to share), offers "public" or "link only", and is dismissible and
 * remembered per recipe in local storage. It shows only for a recipe that is
 * still private and only to its owner — `getPublishState` returns null for
 * anyone else — and disappears the moment the recipe is shared or dismissed.
 */
export function PublishNudge({ recipeId }: { recipeId: string }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const t = useTranslations("social.recipeShare");
  const [dismissed, setDismissed] = useState(() => readDismissed().includes(recipeId));

  const stateQuery = useQuery({
    ...trpc.social.getPublishState.queryOptions({ recipeId }),
    retry: false,
  });

  const setVisibility = useMutation(
    trpc.social.setVisibility.mutationOptions({
      onSuccess: (data) => {
        queryClient.setQueryData(trpc.social.getPublishState.queryKey({ recipeId }), () => ({
          visibility: data.visibility,
          slug: data.slug,
          publishedAt: data.publishedAt,
        }));
        toast.success(
          t(data.visibility === "public" ? "publishNudgeDonePublic" : "publishNudgeDoneUnlisted")
        );
      },
      onError: (error) => showSafeErrorToast(error, t("couldNotSave")),
    })
  );

  // Only for an owner's still-private recipe, and only until acted on/dismissed.
  if (dismissed || stateQuery.data?.visibility !== "private") {
    return null;
  }

  const handleDismiss = () => {
    rememberDismiss(recipeId);
    setDismissed(true);
  };

  return (
    <div className="border-primary/30 bg-primary/5 relative flex flex-col gap-3 rounded-2xl border p-4">
      <button
        aria-label={t("publishNudgeDismiss")}
        className="text-muted hover:text-foreground absolute top-3 right-3 rounded-full p-1"
        type="button"
        onClick={handleDismiss}
      >
        <XMarkIcon className="h-4 w-4" />
      </button>

      <div className="flex items-start gap-3 pr-6">
        <GlobeAltIcon className="text-primary mt-0.5 h-5 w-5 shrink-0" />
        <div>
          <p className="text-foreground text-sm font-semibold">{t("publishNudgeTitle")}</p>
          <p className="text-default-500 text-sm">{t("publishNudgeBody")}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 pl-8">
        <Button
          isPending={setVisibility.isPending}
          size="sm"
          startContent={<GlobeAltIcon className="h-4 w-4" />}
          variant="primary"
          onPress={() => setVisibility.mutate({ recipeId, visibility: "public" })}
        >
          {t("publishNudgePublish")}
        </Button>
        <Button
          isDisabled={setVisibility.isPending}
          size="sm"
          startContent={<LinkIcon className="h-4 w-4" />}
          variant="tertiary"
          onPress={() => setVisibility.mutate({ recipeId, visibility: "unlisted" })}
        >
          {t("publishNudgeUnlisted")}
        </Button>
      </div>
    </div>
  );
}

export default PublishNudge;
