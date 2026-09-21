"use client";

import { useState } from "react";
import { CheckIcon, ShareIcon } from "@heroicons/react/24/outline";
import { toast } from "@heroui/react";
import { useTranslations } from "next-intl";

/**
 * A generic "share this page" button: native share sheet where available,
 * clipboard copy otherwise, with a confirmation. `path` is an app-relative path
 * (e.g. `/u/alice`); the origin is added at click time so tracking query params
 * never leak into the shared link. Reuses the `social.recipe` share strings.
 */
export function ShareLinkButton({
  path,
  title,
  className,
}: {
  path: string;
  title: string;
  className?: string;
}) {
  const t = useTranslations("social.recipe");
  const [copied, setCopied] = useState(false);

  const onPress = async () => {
    const url = `${window.location.origin}${path}`;

    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title, url });

        return;
      } catch (err) {
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
      className={`border-default-200 bg-content1 text-default-600 hover:bg-content2 inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition ${
        className ?? ""
      }`}
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
