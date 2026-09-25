import { SERVER_CONFIG } from "@norish/config/env-config-server";
import { createNotification } from "@norish/db/repositories/notifications";
import { getRecipeNamesByIds } from "@norish/db/repositories/themes";
import { getProfileByUserId } from "@norish/db/repositories/user-profiles";
import { loadLocaleMessages } from "@norish/i18n";
import { APP_NAME } from "@norish/shared-server/email/branding";
import { serverLogger as log } from "@norish/shared-server/logger";
import { isPushConfigured, sendPushToUser } from "@norish/shared-server/push/web-push";

/**
 * The social events that notify a recipe owner / followee. Mirrors the
 * `notification_type` enum.
 */
export type SocialNotificationType = "follow" | "like" | "comment" | "save" | "report";

export interface SocialNotificationInput {
  /** Recipient (recipe owner / followee). */
  userId: string;
  /** Who triggered it. */
  actorId: string;
  type: SocialNotificationType;
  /** Present for like/comment/save/report. */
  recipeId?: string;
}

/**
 * Create the in-app notification AND, when Web Push is configured, send a push
 * to the recipient's devices. The push is best-effort and fire-and-forget: it
 * never blocks or fails the action that triggered it. Self-notifications are
 * skipped (mirrors `createNotification`).
 *
 * Push text is rendered in the instance's default locale — the recipient's own
 * locale isn't known outside a request — reusing the same `social.notifications`
 * strings the in-app bell shows.
 */
export async function sendSocialNotification(input: SocialNotificationInput): Promise<void> {
  await createNotification(input);

  if (input.userId === input.actorId || !isPushConfigured()) return;

  void dispatchPush(input).catch((err: unknown) => {
    log.warn({ err, type: input.type }, "Social push dispatch failed");
  });
}

async function dispatchPush(input: SocialNotificationInput): Promise<void> {
  const locale = SERVER_CONFIG.DEFAULT_LOCALE || "en";
  const messages = await loadLocaleMessages(locale);
  const social = (messages.social ?? {}) as Record<string, unknown>;
  const strings = (social.notifications ?? {}) as Record<string, unknown>;
  const str = (key: string, fallback: string): string =>
    typeof strings[key] === "string" ? (strings[key] as string) : fallback;

  let body: string;
  let url: string;

  if (input.type === "report") {
    // The reporter stays hidden (as in the bell), so no actor name.
    body = str("report", "A comment on your recipe was reported.");
    url = input.recipeId ? `/recipes/${input.recipeId}` : "/";
  } else {
    const actor = await getProfileByUserId(input.actorId);
    const actorName =
      actor?.displayName?.trim() ||
      (actor?.handle ? `@${actor.handle}` : str("someone", "Someone"));

    if (input.type === "follow") {
      body = `${actorName} ${str("follow", "started following you")}`;
      url = actor?.handle ? `/u/${actor.handle}` : "/discover";
    } else {
      const name = input.recipeId
        ? (await getRecipeNamesByIds([input.recipeId])).get(input.recipeId)
        : undefined;
      const namedKey = `${input.type}Named`;
      const action =
        name && typeof strings[namedKey] === "string"
          ? str(namedKey, "").replace("{name}", name)
          : str(input.type, "");

      body = `${actorName} ${action}`.trim();
      url = input.recipeId ? `/recipes/${input.recipeId}` : "/";
    }
  }

  await sendPushToUser(input.userId, {
    title: APP_NAME,
    body,
    url,
    // One push per (type, subject) coalesces repeats rather than stacking.
    tag: `${input.type}:${input.recipeId ?? input.actorId}`,
  });
}
