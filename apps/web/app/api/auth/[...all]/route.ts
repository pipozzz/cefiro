import { auth } from "@norish/auth/auth";
import { runWithInviteToken } from "@norish/auth/registration-bypass";

// A sign-up that comes from a household invite carries the invite token in this
// header. We put it in request scope (never in the user body) so the sign-up
// hook can let that one account through even while public registration is
// locked — after validating the token and that it matches the email.
const INVITE_HEADER = "x-household-invite";

function handle(req: Request): Response | Promise<Response> {
  const token = req.headers.get(INVITE_HEADER);

  return token ? runWithInviteToken(token, () => auth.handler(req)) : auth.handler(req);
}

export const GET = handle;
export const POST = handle;
