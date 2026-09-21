"use client";

import type { KeyboardEvent } from "react";
import { useState } from "react";
import { useTRPC } from "@/app/providers/trpc-provider";
import { SocialRecipeGrid } from "@/components/social/social-recipe-card";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { Spinner } from "@heroui/react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

/**
 * "Cook with what you have": the reader lists ingredients they have on hand and
 * gets public recipes ranked by how many of them each uses (social.searchByIngredients).
 * A distinctive, signed-out-friendly way into discovery.
 */
export function IngredientDiscovery() {
  const trpc = useTRPC();
  const t = useTranslations("social.discover");
  const [input, setInput] = useState("");
  const [chips, setChips] = useState<string[]>([]);

  const addChip = (raw: string) => {
    const value = raw.trim().toLowerCase();

    if (!value) {
      return;
    }

    setChips((current) =>
      current.includes(value) || current.length >= 10 ? current : [...current, value]
    );
    setInput("");
  };

  const removeChip = (value: string) => setChips((current) => current.filter((c) => c !== value));

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addChip(input);
    } else if (e.key === "Backspace" && input === "" && chips.length > 0) {
      setChips((current) => current.slice(0, -1));
    }
  };

  const { data, isLoading } = useQuery({
    ...trpc.social.searchByIngredients.queryOptions({ ingredients: chips, limit: 24 }),
    enabled: chips.length > 0,
    retry: false,
  });

  const recipes = data?.recipes ?? [];

  return (
    <div>
      <label className="bg-content2 focus-within:bg-content1 focus-within:ring-primary flex flex-wrap items-center gap-2 rounded-2xl p-3 ring-1 ring-transparent transition">
        {chips.map((chip) => (
          <span
            key={chip}
            className="bg-primary/15 text-primary inline-flex items-center gap-1 rounded-full py-1 pr-1 pl-3 text-sm font-medium"
          >
            {chip}
            <button
              aria-label={t("clearTag")}
              className="hover:bg-primary/20 rounded-full p-0.5"
              type="button"
              onClick={() => removeChip(chip)}
            >
              <XMarkIcon className="h-4 w-4" />
            </button>
          </span>
        ))}
        <input
          aria-label={t("ingredientPlaceholder")}
          className="text-foreground placeholder:text-default-400 min-w-[8rem] flex-1 bg-transparent py-1 outline-none"
          placeholder={chips.length === 0 ? t("ingredientPlaceholder") : ""}
          value={input}
          onBlur={() => addChip(input)}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
        />
      </label>
      <p className="text-default-500 mt-2 text-sm">{t("ingredientHint")}</p>

      <div className="mt-8">
        {chips.length === 0 ? null : isLoading ? (
          <div className="flex min-h-[30vh] items-center justify-center">
            <Spinner />
          </div>
        ) : recipes.length === 0 ? (
          <p className="bg-content2 text-default-500 rounded-2xl p-10 text-center">
            {t("noIngredientResults")}
          </p>
        ) : (
          <SocialRecipeGrid recipes={recipes} />
        )}
      </div>
    </div>
  );
}
