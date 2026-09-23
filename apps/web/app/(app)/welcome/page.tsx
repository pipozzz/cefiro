"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTRPC } from "@/app/providers/trpc-provider";
import { AvatarUpload } from "@/components/social/avatar-upload";
import { SuggestedCooks } from "@/components/social/suggested-cooks";
import { showSafeErrorToast } from "@/lib/ui/safe-error-toast";
import { CheckCircleIcon } from "@heroicons/react/24/outline";
import { Button, Input, Spinner } from "@heroui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

const HANDLE_RE = /^[a-z][a-z0-9_]*[a-z0-9]$/;

export default function WelcomePage() {
  const trpc = useTRPC();
  const router = useRouter();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/";
  const t = useTranslations("social.welcome");

  const profileQuery = useQuery({ ...trpc.social.getMyProfile.queryOptions(), retry: false });

  const [step, setStep] = useState<"profile" | "cooks" | "recipe">("profile");
  const [handle, setHandle] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");

  // Decide once, from the profile as it was when they arrived: someone who
  // already has a public profile skips onboarding. Deciding only once matters —
  // creating the profile in step 1 must not bounce them out before step 2.
  const [needsOnboarding, setNeedsOnboarding] = useState<boolean | null>(null);
  const decided = useRef(false);

  useEffect(() => {
    if (decided.current || profileQuery.isLoading) {
      return;
    }

    decided.current = true;

    const hasProfile = !!profileQuery.data?.profile;

    setNeedsOnboarding(!hasProfile);

    if (hasProfile) {
      router.replace(next);
    }
  }, [profileQuery.isLoading, profileQuery.data, router, next]);

  const normalizedHandle = handle.trim().toLowerCase();
  const handleValid = normalizedHandle.length >= 3 && HANDLE_RE.test(normalizedHandle);

  const handleCheck = useQuery({
    ...trpc.social.checkHandle.queryOptions({ handle: normalizedHandle }),
    retry: false,
    enabled: handleValid,
  });

  const handleTaken = handleValid && handleCheck.data?.available === false;

  const upsert = useMutation(
    trpc.social.upsertMyProfile.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: trpc.social.getMyProfile.queryKey() });
        setStep("cooks");
      },
      onError: (error) => showSafeErrorToast(error, t("couldNotSave")),
    })
  );

  // Still deciding, or an existing user being redirected away.
  if (needsOnboarding !== true) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-10 md:py-16">
      {step === "profile" ? (
        <>
          <h1 className="text-foreground text-2xl font-bold md:text-3xl">{t("title")}</h1>
          <p className="text-default-500 mt-2">{t("subtitle")}</p>

          <div className="mt-8 flex flex-col gap-5">
            <AvatarUpload
              name={displayName || handle}
              value={avatarUrl.trim() || null}
              onChange={setAvatarUrl}
            />

            <div>
              <label className="text-foreground mb-1 block text-sm font-medium">
                {t("handleLabel")}
              </label>
              <div className="flex items-center gap-2">
                <span className="text-default-500">@</span>
                <Input
                  autoCapitalize="none"
                  autoCorrect="off"
                  placeholder={t("handlePlaceholder")}
                  value={handle}
                  onChange={(e) => setHandle(e.target.value)}
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
                {t("displayNameLabel")}
              </label>
              <Input
                placeholder={t("displayNamePlaceholder")}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </div>

            <div>
              <label className="text-foreground mb-1 block text-sm font-medium">
                {t("bioLabel")}
              </label>
              <textarea
                className="border-default-200 bg-content1 text-foreground focus:border-primary w-full rounded-xl border px-3 py-2 text-sm outline-none"
                maxLength={500}
                placeholder={t("bioPlaceholder")}
                rows={3}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
              />
            </div>

            <div className="flex items-center justify-between">
              <Button as="a" href={next} variant="tertiary">
                {t("skip")}
              </Button>
              <Button
                isDisabled={!handleValid || handleTaken || upsert.isPending}
                isPending={upsert.isPending}
                variant="primary"
                onPress={() =>
                  upsert.mutate({
                    handle: normalizedHandle,
                    displayName: displayName.trim() || null,
                    bio: bio.trim() || null,
                    avatarUrl: avatarUrl.trim() || null,
                    isPublic: true,
                  })
                }
              >
                {t("continue")}
              </Button>
            </div>
          </div>
        </>
      ) : step === "cooks" ? (
        <>
          <h1 className="text-foreground text-2xl font-bold md:text-3xl">{t("followTitle")}</h1>
          <p className="text-default-500 mt-2">{t("followSubtitle")}</p>

          <div className="mt-8">
            <SuggestedCooks limit={9} />
          </div>

          <div className="mt-8 flex items-center justify-between">
            <Button as="a" href={next} variant="tertiary">
              {t("skip")}
            </Button>
            <Button variant="primary" onPress={() => setStep("recipe")}>
              {t("continue")}
            </Button>
          </div>
        </>
      ) : (
        <>
          <h1 className="text-foreground text-2xl font-bold md:text-3xl">{t("recipeTitle")}</h1>
          <p className="text-default-500 mt-2">{t("recipeSubtitle")}</p>

          <div className="mt-8 flex flex-col gap-3">
            <Button variant="primary" onPress={() => router.push("/recipes/new")}>
              {t("recipeCta")}
            </Button>
            <Button as="a" href={next} variant="tertiary">
              {t("done")}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
