import { AsyncLocalStorage } from "node:async_hooks";

import { getHouseholdInviteByToken } from "@norish/db/repositories/household-invites";

/**
 * A request-scoped household invite token, set while a sign-up request that
 * carries a valid invite is being handled. The better-auth `user.create.before`
 * hook reads it (via `inviteAllowsRegistration`) to allow that one account
 * through even when public registration is locked — an invite from an existing
 * member is its own permission to join.
 *
 * Using AsyncLocalStorage (rather than threading the token through better-auth's
 * body) keeps the bypass entirely server-side: the token is set by the auth
 * route handler from a header it trusts, never from a field the client could
 * smuggle into the user record.
 */
const inviteTokenStore = new AsyncLocalStorage<string>();

/** Run `fn` with `token` visible to the sign-up hook. */
export function runWithInviteToken<T>(token: string, fn: () => T): T {
  return inviteTokenStore.run(token, fn);
}

/** The invite token for the in-flight request, or undefined. */
export function currentInviteToken(): string | undefined {
  return inviteTokenStore.getStore();
}

/**
 * Whether the in-flight sign-up's invite token permits `email` to register even
 * while public registration is locked: the invite must be **pending**,
 * **unexpired**, and addressed to **exactly this email** (case-insensitive), so
 * a leaked link cannot be redeemed by a different address. Returns false when no
 * invite token is in request scope (the normal, locked path).
 */
export async function inviteAllowsRegistration(email: string | null | undefined): Promise<boolean> {
  const token = currentInviteToken();

  if (!token || !email) {
    return false;
  }

  const invite = await getHouseholdInviteByToken(token);

  return (
    !!invite &&
    invite.status === "pending" &&
    invite.expiresAt.getTime() > Date.now() &&
    invite.email.toLowerCase() === email.toLowerCase()
  );
}
