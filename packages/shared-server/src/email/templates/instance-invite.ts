export interface InstanceInviteEmailParams {
  /** Display name of the admin who sent the invite, if known. */
  inviterName: string | null;
  /** Absolute URL that opens the instance invite. */
  acceptUrl: string;
  /** The instance's public name, shown in copy. */
  appName: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * The instance-invite email — an invitation to create an account on this server
 * (not to join a household). Inline styles only, a single call-to-action, and
 * the raw link repeated as text for clients that don't render the button.
 */
export function buildInstanceInviteEmail(params: InstanceInviteEmailParams): {
  subject: string;
  html: string;
} {
  const app = escapeHtml(params.appName);
  const inviter = params.inviterName ? escapeHtml(params.inviterName) : null;
  const url = escapeHtml(params.acceptUrl);

  const lead = inviter
    ? `${inviter} invited you to create an account on <strong>${app}</strong>.`
    : `You've been invited to create an account on <strong>${app}</strong>.`;

  const subject = inviter
    ? `${params.inviterName} invited you to ${params.appName}`
    : `You're invited to ${params.appName}`;

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f5f5f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1c1917;">
    <div style="max-width:520px;margin:0 auto;padding:32px 24px;">
      <div style="background:#ffffff;border-radius:16px;padding:32px;border:1px solid #e7e5e4;">
        <h1 style="margin:0 0 16px;font-size:20px;font-weight:700;">Join ${app}</h1>
        <p style="margin:0 0 24px;font-size:15px;line-height:1.5;color:#44403c;">${lead}</p>
        <p style="margin:0 0 24px;font-size:15px;line-height:1.5;color:#44403c;">Set up your own account to discover, save and cook recipes. Accept to get started.</p>
        <a href="${url}" style="display:inline-block;background:#336640;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 20px;border-radius:9999px;">Create my account</a>
        <p style="margin:24px 0 0;font-size:13px;line-height:1.5;color:#78716c;">Or paste this link into your browser:<br /><a href="${url}" style="color:#336640;word-break:break-all;">${url}</a></p>
      </div>
      <p style="margin:20px 0 0;font-size:12px;color:#a8a29e;text-align:center;">This invite expires in 14 days. If you didn't expect it, you can ignore this email.</p>
    </div>
  </body>
</html>`;

  return { subject, html };
}
