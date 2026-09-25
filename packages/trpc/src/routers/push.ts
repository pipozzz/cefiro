import { z } from "zod";

import {
  deletePushSubscription,
  upsertPushSubscription,
} from "@norish/db/repositories/push-subscriptions";
import { trpcLogger as log } from "@norish/shared-server/logger";
import {
  getVapidPublicKey,
  isPushConfigured,
  sendPushToUser,
} from "@norish/shared-server/push/web-push";

import { authedProcedure } from "../middleware";
import { router } from "../trpc";

const SubscriptionInput = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});

/** The VAPID public key + whether push is available, for the client to subscribe. */
const config = authedProcedure.query(() => ({
  configured: isPushConfigured(),
  publicKey: getVapidPublicKey(),
}));

/** Store this browser's push subscription for the signed-in user. */
const subscribe = authedProcedure.input(SubscriptionInput).mutation(async ({ ctx, input }) => {
  await upsertPushSubscription(ctx.user.id, {
    endpoint: input.endpoint,
    p256dh: input.keys.p256dh,
    auth: input.keys.auth,
  });
  log.info({ userId: ctx.user.id }, "Push subscription stored");

  return { ok: true as const };
});

/** Remove this browser's push subscription. */
const unsubscribe = authedProcedure
  .input(z.object({ endpoint: z.string().url() }))
  .mutation(async ({ ctx, input }) => {
    await deletePushSubscription(ctx.user.id, input.endpoint);

    return { ok: true as const };
  });

/** Send a test push to the caller's own devices, so they can confirm it works. */
const sendTest = authedProcedure.mutation(async ({ ctx }) => {
  const delivered = await sendPushToUser(ctx.user.id, {
    title: "Naša Kuchyňa",
    body: "Push notifications are working 🎉",
    url: "/",
    tag: "test",
  });

  return { delivered };
});

export const pushRouter = router({ config, subscribe, unsubscribe, sendTest });
