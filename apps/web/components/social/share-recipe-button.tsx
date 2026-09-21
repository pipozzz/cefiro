"use client";

import { useState } from "react";
import { CheckIcon, ShareIcon } from "@heroicons/react/24/outline";
import { toast } from "@heroui/react";
import { useTranslations } from "next-intl";

/**
 * Share the public recipe link. Uses the native share sheet where it exists
 * (phones), and otherwise copies the canonical `/r/{slug}` URL to the clipboard
 * with a confirmation. Public and auth-free, so it works for signed-out
 * visitors too.
 */
export function ShareRecipeButton({ slug, title }: { slug: string; title: string }) {
  const t = useTranslations("social.recipe");
  const [copied, setCopied] = useState(false);

  const onPress = async () => {
    // Build from the origin rather than location.href so tracking params like
    // `?from=` never leak into a shared link.
    const url = `${window.location.origin}/r/${slug}`;

    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title, url });

        return;
      } catch (err) {
        // The reader dismissed the share sheet — do nothing. Any other failure
        // falls through to the copy path below.
        if (err instanceof DOMException && err.name === "AbortError") {
          return;
        }
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast(t("linkCopied"));
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast(t("shareFailed"), { variant: "danger" });
    }
  };

  return (
    <button
      className="border-default-200 bg-content1 text-default-600 hover:bg-content2 inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition"
      type="button"
      onClick={onPress}
    >
      {copied ? (
        <CheckIcon className="h-5 w-5 text-green-500" />
      ) : (
        <ShareIcon className="h-5 w-5" />
      )}
      <span>{copied ? t("linkCopied") : t("share")}</span>
    </button>
  );
}
