"use client";

import { useEffect, useState } from "react";
import {
  ArrowPathIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  PlusIcon,
  TrashIcon,
} from "@heroicons/react/16/solid";
import { Bars3Icon } from "@heroicons/react/24/outline";
import { Button, Card, Input, Label, Spinner, TextField } from "@heroui/react";
import { useTranslations } from "next-intl";

import type { NavigationConfig, NavLink } from "@norish/config/zod/server-config";
import { ServerConfigKeys } from "@norish/config/zod/server-config";

import { useAdminSettingsContext } from "../context";

type MenuKey = "header" | "footer";

/**
 * Edit the admin-configurable header and footer menus (Ghost-like). Each menu is
 * an ordered list of label + URL links; while a menu is empty the public chrome
 * falls back to its built-in localized links. Stored under the `navigation`
 * server-config key.
 */
export default function NavigationCard() {
  const t = useTranslations("settings.admin.navigation");
  const tActions = useTranslations("common.actions");
  const { navigation, isLoading, updateNavigation, restoreDefaultConfig } =
    useAdminSettingsContext();
  const [values, setValues] = useState<NavigationConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    if (navigation) {
      setValues(navigation);
    }
  }, [navigation]);

  const hasChanges =
    !!values && !!navigation && JSON.stringify(values) !== JSON.stringify(navigation);

  const setLinks = (menu: MenuKey, links: NavLink[]) => {
    setValues((prev) => (prev ? { ...prev, [menu]: links } : prev));
  };

  const setField = (menu: MenuKey, index: number, field: keyof NavLink, value: string) => {
    if (!values) return;
    const next = values[menu].map((link, i) => (i === index ? { ...link, [field]: value } : link));

    setLinks(menu, next);
  };

  const addLink = (menu: MenuKey) => {
    if (!values) return;
    setLinks(menu, [...values[menu], { label: "", url: "" }]);
  };

  const removeLink = (menu: MenuKey, index: number) => {
    if (!values) return;
    setLinks(
      menu,
      values[menu].filter((_, i) => i !== index)
    );
  };

  const moveLink = (menu: MenuKey, index: number, direction: -1 | 1) => {
    if (!values) return;
    const target = index + direction;
    const links = values[menu];

    if (target < 0 || target >= links.length) return;
    const next = [...links];

    [next[index], next[target]] = [next[target], next[index]];
    setLinks(menu, next);
  };

  const handleSave = async () => {
    if (!values) return;
    setSaving(true);
    await updateNavigation(values).finally(() => setSaving(false));
  };

  const handleRestore = async () => {
    setRestoring(true);
    await restoreDefaultConfig(ServerConfigKeys.NAVIGATION).finally(() => setRestoring(false));
  };

  const renderMenu = (menu: MenuKey, headingKey: string, hintKey: string) => {
    if (!values) return null;
    const links = values[menu];

    return (
      <div className="flex flex-col gap-3">
        <div>
          <h3 className="text-base font-semibold">{t(headingKey)}</h3>
          <p className="text-muted text-sm">{t(hintKey)}</p>
        </div>

        {links.length === 0 ? (
          <p className="text-default-500 text-sm italic">{t("emptyMenu")}</p>
        ) : (
          <div className="flex flex-col gap-3">
            {links.map((link, index) => (
              <div
                key={index}
                className="border-border flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-end"
              >
                <TextField
                  className="flex-1"
                  value={link.label}
                  onChange={(v) => setField(menu, index, "label", v)}
                >
                  <Label>{t("labelField")}</Label>
                  <Input variant="secondary" />
                </TextField>
                <TextField
                  className="flex-1"
                  value={link.url}
                  onChange={(v) => setField(menu, index, "url", v)}
                >
                  <Label>{t("urlField")}</Label>
                  <Input placeholder="/about" variant="secondary" />
                </TextField>
                <div className="flex items-center gap-1">
                  <Button
                    isIconOnly
                    aria-label={t("moveUp")}
                    isDisabled={index === 0}
                    size="sm"
                    variant="tertiary"
                    onPress={() => moveLink(menu, index, -1)}
                  >
                    <ChevronUpIcon className="h-4 w-4" />
                  </Button>
                  <Button
                    isIconOnly
                    aria-label={t("moveDown")}
                    isDisabled={index === links.length - 1}
                    size="sm"
                    variant="tertiary"
                    onPress={() => moveLink(menu, index, 1)}
                  >
                    <ChevronDownIcon className="h-4 w-4" />
                  </Button>
                  <Button
                    isIconOnly
                    aria-label={t("removeLink")}
                    size="sm"
                    variant="tertiary"
                    onPress={() => removeLink(menu, index)}
                  >
                    <TrashIcon className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div>
          <Button size="sm" variant="secondary" onPress={() => addLink(menu)}>
            <PlusIcon className="h-4 w-4" />
            {t("addLink")}
          </Button>
        </div>
      </div>
    );
  };

  return (
    <Card>
      <Card.Header>
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Bars3Icon className="h-5 w-5" />
          {t("title")}
        </h2>
      </Card.Header>
      <Card.Content>
        <p className="text-muted mb-4 text-base">{t("description")}</p>

        {isLoading || !values ? (
          <div className="flex items-center justify-center p-8">
            <Spinner size="lg" />
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {renderMenu("header", "headerHeading", "headerHint")}
            {renderMenu("footer", "footerHeading", "footerHint")}

            <div className="flex flex-wrap items-center justify-between gap-2">
              <Button isPending={restoring} variant="tertiary" onPress={handleRestore}>
                {!restoring && <ArrowPathIcon className="h-5 w-5" />}
                {tActions("restoreDefaults")}
              </Button>
              <Button
                isDisabled={!hasChanges}
                isPending={saving}
                variant="primary"
                onPress={handleSave}
              >
                <CheckIcon className="h-5 w-5" />
                {tActions("save")}
              </Button>
            </div>
          </div>
        )}
      </Card.Content>
    </Card>
  );
}
