import webpush from "web-push";

import { SERVER_CONFIG } from "@norish/config/env-config-server";
import {
  deletePushSubscriptionByEndpoint,
  listPushSubscriptionsForUser,
} from "@norish/db/repositories/push-subscriptions";
import { serverLogger as log } from "@norish/shared-server/logger";

/**
 * Web Push (VAPID) sender. Off by default: without a VAPID key pair
 * `isPushConfigured()` is false and callers skip pushing. Payloads are small
 * JSON the service worker renders as a notification.
 *
 * Generate a key pair once with `npx web-push generate-vapid-keys` and set
 * VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY (and optionally VAPID_SUBJECT).
 */

let configured = false;

export function isPushConfigured(): boolean {
  return Boolean(SERVER_CONFIG.VAPID_PUBLIC_KEY && SERVER_CONFIG.VAPID_PRIVATE_KEY);
}

/** The public key the browser needs to subscribe, or null when not configured. */
export function getVapidPublicKey(): string | null {
  return SERVER_CONFIG.VAPID_PUBLIC_KEY ?? null;
}

function ensureVapidDetails(): boolean {
  if (!isPushConfigured()) return false;
  if (configured) return true;

  webpush.setVapidDetails(
    SERVER_CONFIG.VAPID_SUBJECT,
    SERVER_CONFIG.VAPID_PUBLIC_KEY!,
    SERVER_CONFIG.VAPID_PRIVATE_KEY!
  );
  configured = true;

  return true;
}

export interface PushPayload {
  title: string;
  body: string;
  /** Where a click should take the user (defaults to the app root). */
  url?: string;
  /** Coalesces notifications: a newer one with the same tag replaces the old. */
  tag?: string;
}

/**
 * Send a push to every browser a user has subscribed. Best-effort: a send that
 * fails because the subscription is gone (404/410) prunes it; other failures are
 * logged and swallowed, so a dead endpoint never breaks the caller. Returns how
 * many were delivered.
 */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<number> {
  if (!ensureVapidDetails()) return 0;

  const subs = await listPushSubscriptionsForUser(userId);

  if (subs.length === 0) return 0;

  const body = JSON.stringify(payload);
  let delivered = 0;

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          body
        );
        delivered += 1;
      } catch (err) {
        const statusCode = (err as { statusCode?: number }).statusCode;

        if (statusCode === 404 || statusCode === 410) {
          // The subscription is gone (browser cleared it / user revoked). Prune.
          await deletePushSubscriptionByEndpoint(sub.endpoint).catch(() => undefined);
        } else {
          log.warn({ err, userId, statusCode }, "Web push send failed");
        }
      }
    })
  );

  return delivered;
}
