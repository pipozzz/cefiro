"use client";

import { useEffect, useState } from "react";
import { useTRPC } from "@/app/providers/trpc-provider";
import { AvatarUpload } from "@/components/social/avatar-upload";
import { showSafeErrorToast } from "@/lib/ui/safe-error-toast";
import { ArrowTopRightOnSquareIcon, CheckCircleIcon } from "@heroicons/react/24/outline";
import { Button, Input, Spinner, toast } from "@heroui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

const HANDLE_RE = /^[a-z][a-z0-9_]*[a-z0-9]$/;

export default function ProfileSettingsPage() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const t = useTranslations("social.profileSettings");

  const profileQuery = useQuery({
    ...trpc.social.getMyProfile.queryOptions(),
    retry: false,
  });

  const [handle, setHandle] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [location, setLocation] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (profileQuery.data && !hydrated) {
      const p = profileQuery.data.profile;

      if (p) {
        setHandle(p.handle);
        setDisplayName(p.displayName ?? "");
        setBio(p.bio ?? "");
        setAvatarUrl(p.avatarUrl ?? "");
        setLocation(p.location ?? "");
        setWebsiteUrl(p.websiteUrl ?? "");
        setIsPublic(p.isPublic);
      }

      setHydrated(true);
    }
  }, [profileQuery.data, hydrated]);

  const normalizedHandle = handle.trim().toLowerCase();
  const handleValid = normalizedHandle.length >= 3 && HANDLE_RE.test(normalizedHandle);

  const handleCheck = useQuery({
    ...trpc.social.checkHandle.queryOptions({ handle: normalizedHandle }),
    retry: false,
    enabled: handleValid,
  });

  const upsertMutation = useMutation(
    trpc.social.upsertMyProfile.mutationOptions({
      onSuccess: (data) => {
        queryClient.setQueryData(trpc.social.getMyProfile.queryKey(), () => ({
          profile: {
            userId: "",
            handle: data.profile.handle,
            displayName: data.profile.displayName,
            bio: data.profile.bio,
            avatarUrl: data.profile.avatarUrl,
            location: data.profile.location,
            websiteUrl: data.profile.websiteUrl,
            isPublic: data.profile.isPublic,
            createdAt: data.profile.createdAt,
            version: data.profile.version,
          },
        }));
        toast.success(t("saved"));
      },
      onError: (error) => {
        showSafeErrorToast(error, t("couldNotSave"));
      },
    })
  );

  const handleTaken = handleValid && handleCheck.data?.available === false;
  const canSave = handleValid && !handleTaken && !upsertMutation.isPending;

  const onSave = () => {
    upsertMutation.mutate({
      handle: normalizedHandle,
      displayName: displayName.trim() || null,
      bio: bio.trim() || null,
      avatarUrl: avatarUrl.trim() || null,
      location: location.trim() || null,
      websiteUrl: websiteUrl.trim() || null,
      isPublic,
    });
  };

  if (profileQuery.isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Spinner />
      </div>
    );
  }

  const existing = profileQuery.data?.profile;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-foreground text-2xl font-bold">{t("title")}</h1>
          <p className="text-default-500 text-sm">{t("subtitle")}</p>
        </div>
        {existing?.handle && existing.isPublic ? (
          <Button
            as="a"
            href={`/u/${existing.handle}`}
            target="_blank"
            rel="noopener noreferrer"
            variant="tertiary"
            size="sm"
          >
            <ArrowTopRightOnSquareIcon className="h-4 w-4" />
            {t("view")}
          </Button>
        ) : null}
      </div>

      <div className="flex flex-col gap-5">
        <div>
          <label className="text-foreground mb-1 block text-sm font-medium">{t("handle")}</label>
          <div className="flex items-center gap-2">
            <span className="text-default-500">@</span>
            <Input
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              placeholder={t("handlePlaceholder")}
              autoCapitalize="none"
              autoCorrect="off"
            />
          </div>
          <div className="mt-1 min-h-5 text-xs">
            {handle.length > 0 && !handleValid ? (
              <span className="text-danger">{t("handleRule")}</span>
            ) : handleTaken ? (
              <span className="text-danger">{t("handleTaken")}</span>
            ) : handleValid && handleCheck.data?.available ? (
              <span className="text-success inline-flex items-center gap-1">
                <CheckCircleIcon className="h-4 w-4" /> {t("handleAvailable")}
              </span>
            ) : null}
          </div>
        </div>

        <div>
          <label className="text-foreground mb-1 block text-sm font-medium">
            {t("displayName")}
          </label>
          <Input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder={t("displayNamePlaceholder")}
          />
        </div>

        <div>
          <label className="text-foreground mb-1 block text-sm font-medium">{t("bio")}</label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder={t("bioPlaceholder")}
            className="border-default-200 bg-content1 text-foreground focus:border-primary w-full rounded-xl border px-3 py-2 text-sm outline-none"
          />
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label className="text-foreground mb-1 block text-sm font-medium">
              {t("location")}
            </label>
            <Input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder={t("locationPlaceholder")}
            />
          </div>
          <div>
            <label className="text-foreground mb-1 block text-sm font-medium">{t("website")}</label>
            <Input
              value={websiteUrl}
              onChange={(e) => setWebsiteUrl(e.target.value)}
              placeholder={t("websitePlaceholder")}
            />
          </div>
        </div>

        <div>
          <label className="text-foreground mb-2 block text-sm font-medium">
            {t("avatarLabel")}
          </label>
          <AvatarUpload
            value={avatarUrl.trim() || null}
            onChange={setAvatarUrl}
            name={displayName || handle}
          />
        </div>

        {/* Associated via htmlFor + nested control, with visible text below;
            the rule miscounts the nested-span depth. */}
        {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
        <label
          htmlFor="profile-is-public"
          className="border-default-200 bg-content1 flex items-center gap-3 rounded-xl border p-3"
        >
          <input
            id="profile-is-public"
            type="checkbox"
            checked={isPublic}
            onChange={(e) => setIsPublic(e.target.checked)}
            className="h-4 w-4 accent-[var(--heroui-primary,#3f6212)]"
          />
          <span>
            <span className="text-foreground block text-sm font-medium">{t("publicProfile")}</span>
            <span className="text-default-500 block text-xs">{t("publicProfileHint")}</span>
          </span>
        </label>

        <div className="flex justify-end">
          <Button
            variant="primary"
            onPress={onSave}
            isDisabled={!canSave}
            isPending={upsertMutation.isPending}
          >
            {t("save")}
          </Button>
        </div>
      </div>
    </div>
  );
}
