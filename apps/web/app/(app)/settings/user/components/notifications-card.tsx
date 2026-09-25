"use client";

import { useEffect, useState } from "react";
import SettingsSwitch from "@/app/(app)/settings/components/settings-switch";
import { useTRPC } from "@/app/providers/trpc-provider";
import { BellAlertIcon } from "@heroicons/react/24/outline";
import { Button, Card, toast } from "@heroui/react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

/** Decode a base64url VAPID key into the Uint8Array `pushManager.subscribe` wants. */
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(normalized);
  const output = new Uint8Array(raw.length);

  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);

  return output;
}

type Support = "checking" | "unsupported" | "ready";

export default function NotificationsCard() {
  const t = useTranslations("settings.user.notifications");
  const trpc = useTRPC();

  const [support, setSupport] = useState<Support>("checking");
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);

  const configQuery = useQuery(trpc.push.config.queryOptions(undefined, { retry: false }));
  const subscribeMutation = useMutation(trpc.push.subscribe.mutationOptions());
  const unsubscribeMutation = useMutation(trpc.push.unsubscribe.mutationOptions());
  const testMutation = useMutation(trpc.push.sendTest.mutationOptions());

  // Detect support and reflect the browser's existing subscription state.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (
        typeof window === "undefined" ||
        !("serviceWorker" in navigator) ||
        !("PushManager" in window) ||
        !("Notification" in window)
      ) {
        if (!cancelled) setSupport("unsupported");

        return;
      }

      try {
        const reg = await navigator.serviceWorker.ready;
        const existing = await reg.pushManager.getSubscription();

        if (!cancelled) {
          setSubscribed(!!existing);
          setSupport("ready");
        }
      } catch {
        if (!cancelled) setSupport("unsupported");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const enable = async () => {
    const publicKey = configQuery.data?.publicKey;

    if (!publicKey) return;

    setBusy(true);
    try {
      const permission = await Notification.requestPermission();

      if (permission !== "granted") {
        toast(t("permissionDenied"), { variant: "warning" });

        return;
      }

      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
      const json = sub.toJSON();

      await subscribeMutation.mutateAsync({
        endpoint: sub.endpoint,
        keys: { p256dh: json.keys?.p256dh ?? "", auth: json.keys?.auth ?? "" },
      });
      setSubscribed(true);
      toast.success(t("enabled"));
    } catch {
      toast(t("failed"), { variant: "danger" });
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();

      if (sub) {
        await unsubscribeMutation.mutateAsync({ endpoint: sub.endpoint });
        await sub.unsubscribe();
      }
      setSubscribed(false);
    } catch {
      toast(t("failed"), { variant: "danger" });
    } finally {
      setBusy(false);
    }
  };

  const sendTest = async () => {
    try {
      const { delivered } = await testMutation.mutateAsync();

      toast.success(delivered > 0 ? t("testSent") : t("testNone"));
    } catch {
      toast(t("failed"), { variant: "danger" });
    }
  };

  // Push isn't configured on this server, or the browser can't do it: hide the
  // card entirely rather than show a dead toggle.
  if (support === "unsupported" || configQuery.data?.configured === false) {
    return null;
  }

  return (
    <Card>
      <Card.Header>
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <BellAlertIcon className="h-5 w-5" />
          {t("title")}
        </h2>
      </Card.Header>
      <Card.Content className="gap-4">
        <p className="text-muted text-base">{t("description")}</p>
        <div className="flex items-center justify-between gap-4">
          <span className="text-sm font-medium">{t("toggleLabel")}</span>
          <SettingsSwitch
            isDisabled={busy || support === "checking" || !configQuery.data?.publicKey}
            isSelected={subscribed}
            onValueChange={(selected) => (selected ? void enable() : void disable())}
          />
        </div>
        {subscribed ? (
          <div>
            <Button
              isPending={testMutation.isPending}
              size="sm"
              variant="tertiary"
              onPress={sendTest}
            >
              {t("sendTest")}
            </Button>
          </div>
        ) : null}
      </Card.Content>
    </Card>
  );
}
