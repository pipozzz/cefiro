import { TRPCError } from "@trpc/server";

import { trpcLogger as log } from "@norish/shared-server/logger";
import { getPublisherClient } from "@norish/shared-server/redis/client";

import { middleware } from "./trpc";

export interface RateLimitOptions {
  /** Stable name used in the Redis key and logs, e.g. "social.postComment". */
  name: string;
  /** Max allowed calls per window, per user. */
  limit: number;
  /** Window length in seconds. */
  windowSec: number;
}

/**
 * Fixed-window rate limiter backed by Redis, keyed by the authenticated user.
 *
 * A per-user counter is INCRed once per call and expires with the window, so a
 * user gets at most `limit` calls per `windowSec`. Over the limit throws
 * TOO_MANY_REQUESTS (HTTP 429).
 *
 * Fails OPEN: if Redis is unreachable the call is allowed, because dropping a
 * genuine action is worse than missing a rate-limit check. Meant to sit on
 * `authedProcedure` (it keys by `ctx.user.id`); without a user it degrades to a
 * single shared "anon" bucket.
 */
export function rateLimit({ name, limit, windowSec }: RateLimitOptions) {
  return middleware(async ({ ctx, next }) => {
    const userId = ctx.user?.id ?? "anon";
    const bucket = Math.floor(Date.now() / (windowSec * 1000));
    const key = `rl:${name}:${userId}:${bucket}`;

    let count: number | null = null;

    try {
      const redis = await getPublisherClient();

      count = await redis.incr(key);

      // Only the first write in a window needs the TTL; +1s covers rounding.
      if (count === 1) {
        await redis.expire(key, windowSec + 1);
      }
    } catch (err) {
      // Fail open — never block a real action because the limiter is down.
      log.error({ err, name, userId }, "Rate limiter unavailable; allowing request");

      return next();
    }

    if (count > limit) {
      log.warn({ name, userId, count, limit, windowSec }, "Rate limit exceeded");

      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: "You're doing that too fast. Please slow down and try again in a moment.",
      });
    }

    return next();
  });
}
