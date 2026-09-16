"use client";

import { useState } from "react";
import { useTRPC } from "@/app/providers/trpc-provider";
import { showSafeErrorToast } from "@/lib/ui/safe-error-toast";
import {
  ArrowTopRightOnSquareIcon,
  ClipboardDocumentIcon,
  GlobeAltIcon,
  LinkIcon,
  LockClosedIcon,
} from "@heroicons/react/24/outline";
import { Button, Card, Spinner, toast } from "@heroui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { RecipeVisibility } from "@norish/shared/contracts/zod";

type Props = {
  recipeId: string;
};

const OPTIONS: Array<{
  value: RecipeVisibility;
  label: string;
  description: string;
  icon: typeof GlobeAltIcon;
}> = [
  {
    value: "private",
    label: "Private",
    description: "Only you and your household",
    icon: LockClosedIcon,
  },
  {
    value: "unlisted",
    label: "Unlisted",
    description: "Anyone with the link",
    icon: LinkIcon,
  },
  {
    value: "public",
    label: "Public",
    description: "On your profile & discovery",
    icon: GlobeAltIcon,
  },
];

export default function RecipePublishControl({ recipeId }: Props) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
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
        showSafeErrorToast(error, "Could not update sharing");
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
      toast.success("Link copied");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard may be unavailable; ignore.
    }
  };

  return (
    <Card className="bg-surface-secondary/40 border-border border">
      <Card.Content className="gap-3">
        <div className="flex items-center gap-2">
          <GlobeAltIcon className="text-primary h-5 w-5" />
          <h3 className="text-sm font-semibold">Publish to community</h3>
          {stateQuery.isLoading ? <Spinner size="sm" /> : null}
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {OPTIONS.map((option) => {
            const Icon = option.icon;
            const active = current === option.value;

            return (
              <button
                key={option.value}
                type="button"
                disabled={setVisibilityMutation.isPending || stateQuery.isLoading}
                onClick={() => setVisibilityMutation.mutate({ recipeId, visibility: option.value })}
                className={[
                  "flex flex-col items-start gap-1 rounded-2xl border p-3 text-left transition",
                  active
                    ? "border-primary bg-primary/10 ring-primary ring-1"
                    : "border-border bg-content1 hover:bg-content2",
                  setVisibilityMutation.isPending ? "opacity-60" : "",
                ].join(" ")}
              >
                <span className="flex items-center gap-1.5 text-sm font-medium">
                  <Icon className="h-4 w-4" />
                  {option.label}
                </span>
                <span className="text-default-500 text-xs">{option.description}</span>
              </button>
            );
          })}
        </div>

        {current !== "private" && publicUrl ? (
          <div className="border-success/30 bg-success/10 rounded-2xl border p-3">
            <p className="mb-2 text-sm font-medium">Public link</p>
            <div className="flex items-center gap-2">
              <code className="bg-content2 flex-1 truncate rounded-lg px-2 py-1.5 text-xs">
                {publicUrl}
              </code>
              <Button size="sm" variant="tertiary" onPress={handleCopy} className="min-w-16">
                <ClipboardDocumentIcon className="h-4 w-4" />
                {copied ? "Copied" : "Copy"}
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
                Open
              </Button>
            </div>
          </div>
        ) : null}
      </Card.Content>
    </Card>
  );
}
