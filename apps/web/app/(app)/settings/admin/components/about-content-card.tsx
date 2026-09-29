"use client";

import { useEffect, useState } from "react";
import { ArrowPathIcon, CheckIcon } from "@heroicons/react/16/solid";
import { InformationCircleIcon } from "@heroicons/react/24/outline";
import {
  Button,
  Card,
  Description,
  Input,
  Label,
  Spinner,
  TextArea,
  TextField,
} from "@heroui/react";
import { useTranslations } from "next-intl";

import type { AboutContent } from "@norish/config/zod/server-config";
import { ServerConfigKeys } from "@norish/config/zod/server-config";

import { useAdminSettingsContext } from "../context";

const LANGS = [
  { code: "sk", labelKey: "slovak" },
  { code: "en", labelKey: "english" },
] as const;

/**
 * Edit the public /about page copy (title + Markdown body) per content language.
 * Stored under the `about_content` server-config key; the /about page reads it
 * with a fallback to the shipped default, and "restore defaults" reverts to that.
 */
export default function AboutContentCard() {
  const t = useTranslations("settings.admin.aboutContent");
  const tActions = useTranslations("common.actions");
  const { aboutContent, isLoading, updateAboutContent, restoreDefaultConfig } =
    useAdminSettingsContext();
  const [values, setValues] = useState<AboutContent | null>(null);
  const [saving, setSaving] = useState(false);
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    if (aboutContent) {
      setValues(aboutContent);
    }
  }, [aboutContent]);

  const hasChanges =
    !!values && !!aboutContent && JSON.stringify(values) !== JSON.stringify(aboutContent);

  const setField = (lang: "sk" | "en", field: "title" | "body", value: string) => {
    setValues((prev) => (prev ? { ...prev, [lang]: { ...prev[lang], [field]: value } } : prev));
  };

  const handleSave = async () => {
    if (!values) return;
    setSaving(true);
    await updateAboutContent(values).finally(() => setSaving(false));
  };

  const handleRestore = async () => {
    setRestoring(true);
    await restoreDefaultConfig(ServerConfigKeys.ABOUT_CONTENT).finally(() => setRestoring(false));
  };

  return (
    <Card>
      <Card.Header>
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <InformationCircleIcon className="h-5 w-5" />
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
            {LANGS.map(({ code, labelKey }) => (
              <div key={code} className="flex flex-col gap-3">
                <h3 className="text-base font-semibold">{t(labelKey)}</h3>
                <TextField value={values[code].title} onChange={(v) => setField(code, "title", v)}>
                  <Label>{t("titleLabel")}</Label>
                  <Input variant="secondary" />
                </TextField>
                <TextField value={values[code].body} onChange={(v) => setField(code, "body", v)}>
                  <Label>{t("bodyLabel")}</Label>
                  <TextArea rows={14} variant="secondary" />
                  <Description>{t("bodyHelp")}</Description>
                </TextField>
              </div>
            ))}

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
