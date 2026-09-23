import { auth } from "@norish/auth/auth";
import { runWithInviteToken } from "@norish/auth/registration-bypass";

// A sign-up that comes from an invite carries the invite token in one of these
// headers — a household invite (join a household) or an instance invite
// (register a new account on this server). We put it in request scope (never in
// the user body) so the sign-up hook can let that one account through even while
// public registration is locked — after validating the token and email match.
const HOUSEHOLD_INVITE_HEADER = "x-household-invite";
const INSTANCE_INVITE_HEADER = "x-instance-invite";

function handle(req: Request): Response | Promise<Response> {
  const token = req.headers.get(HOUSEHOLD_INVITE_HEADER) ?? req.headers.get(INSTANCE_INVITE_HEADER);

  return token ? runWithInviteToken(token, () => auth.handler(req)) : auth.handler(req);
}

export const GET = handle;
export const POST = handle;
