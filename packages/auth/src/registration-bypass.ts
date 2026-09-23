import { AsyncLocalStorage } from "node:async_hooks";

import { getHouseholdInviteByToken } from "@norish/db/repositories/household-invites";
import { getInstanceInviteByToken } from "@norish/db/repositories/instance-invites";

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
 *
 * The token may be either a household invite (join a specific household) or an
 * instance invite (register a fresh account on this server). A random token
 * matches at most one of the two tables, so both are checked.
 */
export async function inviteAllowsRegistration(email: string | null | undefined): Promise<boolean> {
  const token = currentInviteToken();

  if (!token || !email) {
    return false;
  }

  const now = Date.now();
  const wanted = email.toLowerCase();

  const householdInvite = await getHouseholdInviteByToken(token);

  if (
    householdInvite &&
    householdInvite.status === "pending" &&
    householdInvite.expiresAt.getTime() > now &&
    householdInvite.email.toLowerCase() === wanted
  ) {
    return true;
  }

  const instanceInvite = await getInstanceInviteByToken(token);

  return (
    !!instanceInvite &&
    instanceInvite.status === "pending" &&
    instanceInvite.expiresAt.getTime() > now &&
    instanceInvite.email.toLowerCase() === wanted
  );
}
