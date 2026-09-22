"use client";

import { useState } from "react";
import { useUnitFormatter } from "@/hooks/use-unit-formatter";
import { CheckIcon, ShareIcon } from "@heroicons/react/16/solid";
import { Button, toast } from "@heroui/react";
import { useTranslations } from "next-intl";

import type { GroceryDto, StoreDto } from "@norish/shared/contracts";

const NO_STORE = "__no_store__";

/**
 * Share the shopping list as plain text — the "pošli mi zoznam" a cook sends a
 * partner. Uses the native share sheet where available (so the list drops
 * straight into WhatsApp/Messages), and falls back to copying to the clipboard.
 *
 * Only the not-yet-bought items are shared, grouped under their store exactly
 * as the list shows them, with amounts formatted the same way (via the shared
 * unit formatter) so what lands in the message matches what is on screen.
 * Renders nothing when there is nothing left to buy.
 */
export default function ShareGroceriesButton({
  groceries,
  stores,
}: {
  groceries: GroceryDto[];
  stores: StoreDto[];
}) {
  const t = useTranslations("groceries.page");
  const tItem = useTranslations("groceries.item");
  const { formatAmountUnit } = useUnitFormatter();
  const [copied, setCopied] = useState(false);

  const pending = groceries.filter((g) => !g.isDone);

  if (pending.length === 0) {
    return null;
  }

  const buildText = (): string => {
    const knownStore = new Set(stores.map((s) => s.id));
    const byStore = new Map<string, GroceryDto[]>();

    for (const item of pending) {
      const key = item.storeId && knownStore.has(item.storeId) ? item.storeId : NO_STORE;
      const bucket = byStore.get(key);

      if (bucket) {
        bucket.push(item);
      } else {
        byStore.set(key, [item]);
      }
    }

    const lines: string[] = [t("shareTitle")];

    const emit = (heading: string | null, items: GroceryDto[]) => {
      lines.push("");

      if (heading) {
        lines.push(heading);
      }

      for (const item of items) {
        const amount = formatAmountUnit(item.amount, item.unit);
        const name = item.name ?? tItem("unnamedItem");

        lines.push(`- ${amount ? `${amount} ` : ""}${name}`.trimEnd());
      }
    };

    // Stores in the order the reader arranged them, then the unfiled items.
    for (const store of stores) {
      const items = byStore.get(store.id);

      if (items && items.length > 0) {
        emit(store.name, items);
      }
    }

    const unfiled = byStore.get(NO_STORE);

    if (unfiled && unfiled.length > 0) {
      // Only label the group when there are named stores to distinguish it from.
      emit(stores.length > 0 ? t("shareOther") : null, unfiled);
    }

    return lines.join("\n");
  };

  const onPress = async () => {
    const text = buildText();
    const title = t("shareTitle");

    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title, text });

        return;
      } catch (err) {
        // The user dismissing the share sheet is not a failure.
        if (err instanceof DOMException && err.name === "AbortError") {
          return;
        }
      }
    }

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast(t("shareCopied"));
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast(t("shareFailed"), { variant: "danger" });
    }
  };

  return (
    <Button
      className="rounded-full font-medium"
      size="sm"
      startContent={copied ? <CheckIcon className="h-4 w-4" /> : <ShareIcon className="h-4 w-4" />}
      variant="tertiary"
      onPress={onPress}
    >
      {t("shareList")}
    </Button>
  );
}
