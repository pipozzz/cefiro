export interface HouseholdInviteEmailParams {
  householdName: string;
  /** Display name of the person who sent the invite, if known. */
  inviterName: string | null;
  /** Absolute URL that accepts the invite. */
  acceptUrl: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * The household invite email. Inline styles only (email clients strip <style>),
 * a single clear call-to-action, and the raw link repeated as text for clients
 * that don't render the button.
 */
export function buildHouseholdInviteEmail(params: HouseholdInviteEmailParams): {
  subject: string;
  html: string;
} {
  const household = escapeHtml(params.householdName);
  const inviter = params.inviterName ? escapeHtml(params.inviterName) : null;
  const url = escapeHtml(params.acceptUrl);

  const lead = inviter
    ? `${inviter} invited you to join their household <strong>${household}</strong> on Naša Kuchyňa.`
    : `You've been invited to join the household <strong>${household}</strong> on Naša Kuchyňa.`;

  const subject = inviter
    ? `${params.inviterName} invited you to ${params.householdName} on Naša Kuchyňa`
    : `You're invited to ${params.householdName} on Naša Kuchyňa`;

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f5f5f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1c1917;">
    <div style="max-width:520px;margin:0 auto;padding:32px 24px;">
      <div style="background:#ffffff;border-radius:16px;padding:32px;border:1px solid #e7e5e4;">
        <h1 style="margin:0 0 16px;font-size:20px;font-weight:700;">Join ${household}</h1>
        <p style="margin:0 0 24px;font-size:15px;line-height:1.5;color:#44403c;">${lead}</p>
        <p style="margin:0 0 24px;font-size:15px;line-height:1.5;color:#44403c;">A household shares recipes, groceries and meal plans. Accept to get in.</p>
        <a href="${url}" style="display:inline-block;background:#336640;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 20px;border-radius:9999px;">Accept invite</a>
        <p style="margin:24px 0 0;font-size:13px;line-height:1.5;color:#78716c;">Or paste this link into your browser:<br /><a href="${url}" style="color:#336640;word-break:break-all;">${url}</a></p>
      </div>
      <p style="margin:20px 0 0;font-size:12px;color:#a8a29e;text-align:center;">This invite expires in 14 days. If you didn't expect it, you can ignore this email.</p>
    </div>
  </body>
</html>`;

  return { subject, html };
}
