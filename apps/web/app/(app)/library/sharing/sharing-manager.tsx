"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useTRPC } from "@/app/providers/trpc-provider";
import { showSafeErrorToast } from "@/lib/ui/safe-error-toast";
import { ArrowLeftIcon, GlobeAltIcon, LinkIcon, LockClosedIcon } from "@heroicons/react/16/solid";
import { Button, Spinner, toast } from "@heroui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

import type { RecipeVisibility } from "@norish/shared/contracts";

type Filter = "all" | RecipeVisibility;

const VISIBILITY_ICON: Record<RecipeVisibility, typeof LockClosedIcon> = {
  private: LockClosedIcon,
  unlisted: LinkIcon,
  public: GlobeAltIcon,
};

const VISIBILITY_STYLE: Record<RecipeVisibility, string> = {
  private: "bg-content2 text-default-500",
  unlisted: "bg-warning/15 text-warning-700",
  public: "bg-success/15 text-success-700",
};

/**
 * Bulk sharing manager: the owner ticks recipes and sets them public / link-only
 * / private in one go — the fast path to turning an existing library into public
 * recipes that discovery and search can reach. Deliberately explicit (nothing is
 * published without a tick), and it skips server-side any id that is not the
 * caller's.
 */
export function SharingManager() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const t = useTranslations("social.sharing");
  const tShare = useTranslations("social.recipeShare");

  const [filter, setFilter] = useState<Filter>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const listQuery = useQuery({
    ...trpc.social.myRecipesForSharing.queryOptions(),
    retry: false,
  });

  const recipes = useMemo(() => listQuery.data ?? [], [listQuery.data]);
  const filtered = useMemo(
    () => (filter === "all" ? recipes : recipes.filter((r) => r.visibility === filter)),
    [recipes, filter]
  );

  const bulk = useMutation(
    trpc.social.setVisibilityBulk.mutationOptions({
      onSuccess: (data) => {
        void queryClient.invalidateQueries({
          queryKey: trpc.social.myRecipesForSharing.queryKey(),
        });
        setSelected(new Set());
        toast.success(
          data.skippedImported > 0
            ? t("doneWithSkipped", { updated: data.updated, skipped: data.skippedImported })
            : t("done", { count: data.updated })
        );
      },
      onError: (error) => showSafeErrorToast(error, tShare("couldNotSave")),
    })
  );

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);

      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }

      return next;
    });

  const allFilteredSelected = filtered.length > 0 && filtered.every((r) => selected.has(r.id));
  const toggleAll = () =>
    setSelected((prev) => {
      if (allFilteredSelected) {
        const next = new Set(prev);

        filtered.forEach((r) => next.delete(r.id));

        return next;
      }

      return new Set([...prev, ...filtered.map((r) => r.id)]);
    });

  const apply = (visibility: RecipeVisibility) => {
    const recipeIds = [...selected].slice(0, 200);

    if (recipeIds.length > 0) {
      bulk.mutate({ recipeIds, visibility });
    }
  };

  const filters: Filter[] = ["all", "private", "unlisted", "public"];

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-32 md:px-6">
      <div className="mb-2">
        <Link
          className="text-muted hover:text-foreground inline-flex items-center gap-1 text-sm no-underline"
          href="/library"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          {t("backToLibrary")}
        </Link>
      </div>

      <h1 className="text-foreground text-2xl font-bold">{t("title")}</h1>
      <p className="text-default-500 mt-1 text-sm">{t("subtitle")}</p>
      <p className="text-default-400 mt-1 mb-6 text-xs">{t("importedNote")}</p>

      {/* Filter chips */}
      <div className="mb-4 flex flex-wrap gap-2">
        {filters.map((f) => (
          <button
            key={f}
            className={`rounded-full px-3 py-1 text-sm font-medium transition ${
              filter === f
                ? "bg-primary text-primary-foreground"
                : "bg-content2 text-default-600 hover:text-foreground"
            }`}
            type="button"
            onClick={() => setFilter(f)}
          >
            {f === "all" ? t("filterAll") : tShare(f)}
          </button>
        ))}
      </div>

      {listQuery.isLoading ? (
        <div className="flex min-h-[30vh] items-center justify-center">
          <Spinner />
        </div>
      ) : filtered.length === 0 ? (
        <p className="bg-content2 text-default-500 rounded-2xl p-10 text-center">{t("empty")}</p>
      ) : (
        <>
          <label className="mb-2 flex cursor-pointer items-center gap-3 px-1 text-sm font-medium select-none">
            <input
              checked={allFilteredSelected}
              className="size-4 accent-[var(--primary,#336640)]"
              type="checkbox"
              onChange={toggleAll}
            />
            {t("selectAll")}
          </label>

          <ul className="border-border divide-border divide-y overflow-hidden rounded-2xl border">
            {filtered.map((recipe) => {
              const Icon = VISIBILITY_ICON[recipe.visibility];

              return (
                <li key={recipe.id}>
                  <label className="hover:bg-content2/50 flex cursor-pointer items-center gap-3 p-3 transition select-none">
                    <input
                      checked={selected.has(recipe.id)}
                      className="size-4 shrink-0 accent-[var(--primary,#336640)]"
                      type="checkbox"
                      onChange={() => toggle(recipe.id)}
                    />
                    <span className="text-foreground min-w-0 flex-1 truncate">{recipe.name}</span>
                    {recipe.imported ? (
                      <span
                        className="bg-warning/15 text-warning-700 inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
                        title={t("importedHint")}
                      >
                        {t("importedBadge")}
                      </span>
                    ) : null}
                    <span
                      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${VISIBILITY_STYLE[recipe.visibility]}`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {tShare(recipe.visibility)}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {/* Sticky action bar when a selection exists. */}
      {selected.size > 0 ? (
        <div className="fixed inset-x-0 bottom-0 z-50 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <div className="border-border bg-surface mx-auto flex max-w-3xl flex-wrap items-center gap-2 rounded-2xl border p-3 shadow-xl">
            <span className="text-foreground mr-auto text-sm font-medium">
              {t("selected", { count: selected.size })}
            </span>
            <Button
              isPending={bulk.isPending}
              size="sm"
              startContent={<GlobeAltIcon className="h-4 w-4" />}
              variant="primary"
              onPress={() => apply("public")}
            >
              {t("makePublic")}
            </Button>
            <Button
              isDisabled={bulk.isPending}
              size="sm"
              startContent={<LinkIcon className="h-4 w-4" />}
              variant="secondary"
              onPress={() => apply("unlisted")}
            >
              {t("makeUnlisted")}
            </Button>
            <Button
              isDisabled={bulk.isPending}
              size="sm"
              startContent={<LockClosedIcon className="h-4 w-4" />}
              variant="tertiary"
              onPress={() => apply("private")}
            >
              {t("makePrivate")}
            </Button>
            <Button
              isDisabled={bulk.isPending}
              size="sm"
              variant="tertiary"
              onPress={() => setSelected(new Set())}
            >
              {t("clear")}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default SharingManager;
