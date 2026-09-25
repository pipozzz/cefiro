import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { SERVER_CONFIG } from "@norish/config/env-config-server";
import {
  createInstanceInvite,
  getInstanceInviteByToken,
  listPendingInstanceInvites,
  markInstanceInviteAccepted,
  revokeInstanceInvite,
} from "@norish/db";
import { APP_NAME } from "@norish/shared-server/email/branding";
import { isEmailConfigured, sendEmail } from "@norish/shared-server/email/mailer";
import { buildInstanceInviteEmail } from "@norish/shared-server/email/templates/instance-invite";
import { trpcLogger as log } from "@norish/shared-server/logger";

import { adminProcedure, authedProcedure } from "../middleware";
import { rateLimit } from "../rate-limit-middleware";
import { publicProcedure, router } from "../trpc";

/** Absolute URL of the public instance-invite page for a token (signed-out). */
function instanceInviteUrl(token: string): string {
  return `${SERVER_CONFIG.AUTH_URL}/instance-invite/${encodeURIComponent(token)}`;
}

// --- Admin: create / list / revoke --------------------------------------

const create = adminProcedure
  .input(z.object({ email: z.string().trim().email() }))
  .mutation(async ({ ctx, input }) => {
    log.info({ userId: ctx.user.id }, "Creating instance invite");

    const { invite, token } = await createInstanceInvite({
      email: input.email,
      invitedByUserId: ctx.user.id,
    });

    const acceptUrl = instanceInviteUrl(token);
    let emailed = false;

    if (isEmailConfigured()) {
      const { subject, html } = await buildInstanceInviteEmail({
        inviterName: ctx.user.name ?? null,
        acceptUrl,
        appName: APP_NAME,
      });

      try {
        const result = await sendEmail({ to: invite.email, subject, html });

        emailed = result.sent;
      } catch (err) {
        // A delivery failure must not lose the invite: it still exists and the
        // admin gets the copyable link back to share manually.
        log.error({ err }, "Failed to send instance invite email");
      }
    }

    return {
      invite: {
        id: invite.id,
        email: invite.email,
        expiresAt: invite.expiresAt.toISOString(),
      },
      // The admin may share this link directly — useful when email is not
      // configured or delivery is delayed.
      link: acceptUrl,
      emailed,
    };
  });

const list = adminProcedure.query(async () => {
  const invites = await listPendingInstanceInvites();

  return {
    invites: invites.map((invite) => ({
      id: invite.id,
      email: invite.email,
      expiresAt: invite.expiresAt.toISOString(),
      createdAt: invite.createdAt.toISOString(),
    })),
  };
});

const revoke = adminProcedure
  .input(z.object({ inviteId: z.string().uuid() }))
  .mutation(async ({ ctx, input }) => {
    const revoked = await revokeInstanceInvite(input.inviteId);

    if (!revoked) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Invite not found" });
    }

    log.info({ userId: ctx.user.id, inviteId: input.inviteId }, "Revoked instance invite");

    return { success: true };
  });

// --- Public / invitee: preview + accept ---------------------------------

/**
 * Preview an invite from its token, so the landing page can render before the
 * invitee has an account (registration may be locked). Rate-limited so a token
 * cannot be probed for. Returns the invited email so the sign-up form can
 * pre-fill and lock it — the recipient already holds the link.
 */
const get = publicProcedure
  .use(rateLimit({ name: "instanceInvites.get", limit: 30, windowSec: 60 }))
  .input(z.object({ token: z.string().min(1) }))
  .query(async ({ input }) => {
    const invite = await getInstanceInviteByToken(input.token);

    if (!invite || invite.status !== "pending" || invite.expiresAt.getTime() < Date.now()) {
      return { invite: null };
    }

    return { invite: { email: invite.email } };
  });

/**
 * Mark the invite accepted once the invitee has an account. The sign-up gate
 * already enforced that the token permits this email; here we just close the
 * invite. No household is joined — the user keeps their own fresh account.
 */
const accept = authedProcedure
  .input(z.object({ token: z.string().min(1) }))
  .mutation(async ({ ctx, input }) => {
    const invite = await getInstanceInviteByToken(input.token);

    if (!invite || invite.status !== "pending" || invite.expiresAt.getTime() < Date.now()) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "This invite is invalid or has expired",
      });
    }

    await markInstanceInviteAccepted(invite.id, ctx.user.id);

    return { success: true };
  });

/** Admin-only procedures, mounted under `admin.instanceInvites`. */
export const instanceInvitesAdminProcedures = router({ create, list, revoke });

/** Public/invitee procedures, mounted top-level as `instanceInvites`. */
export const instanceInvitesRouter = router({ get, accept });
