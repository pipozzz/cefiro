"use client";

import { useRef } from "react";
import { useTRPC } from "@/app/providers/trpc-provider";
import { showSafeErrorToast } from "@/lib/ui/safe-error-toast";
import { Button } from "@heroui/react";
import { useMutation } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

/**
 * Public profile avatar: a preview plus an upload button. The upload returns a
 * public `/public-avatars/...` URL, handed back through `onChange` so the
 * surrounding profile form persists it like any other field.
 */
export function AvatarUpload({
  value,
  onChange,
  name,
}: {
  value: string | null;
  onChange: (url: string) => void;
  name: string;
}) {
  const trpc = useTRPC();
  const t = useTranslations("social.avatar");
  const inputRef = useRef<HTMLInputElement>(null);

  const upload = useMutation(
    trpc.social.uploadProfileAvatar.mutationOptions({
      onSuccess: (data) => onChange(data.url),
      onError: (error) => showSafeErrorToast(error, t("couldNotUpload")),
    })
  );

  const initial = (name.trim() || "?").charAt(0).toUpperCase();

  return (
    <div className="flex items-center gap-4">
      {value ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={value}
          alt=""
          className="ring-default-200 h-16 w-16 rounded-full object-cover ring-2"
        />
      ) : (
        <span className="bg-primary text-primary-foreground flex h-16 w-16 items-center justify-center rounded-full text-xl font-semibold">
          {initial}
        </span>
      )}

      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];

            if (!file) {
              return;
            }

            const formData = new FormData();

            formData.append("avatar", file);
            upload.mutate(formData);
            e.target.value = "";
          }}
        />
        <Button
          variant="tertiary"
          size="sm"
          isPending={upload.isPending}
          onPress={() => inputRef.current?.click()}
        >
          {t("upload")}
        </Button>
        {value ? (
          <Button
            variant="tertiary"
            size="sm"
            isDisabled={upload.isPending}
            onPress={() => onChange("")}
          >
            {t("remove")}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
