import { emailCopy, fmt, resolveEmailLocale } from "@norish/shared-server/email/i18n";
import { renderBrandedEmail } from "@norish/shared-server/email/layout";

export interface InstanceInviteEmailParams {
  /** Display name of the admin who sent the invite, if known. */
  inviterName: string | null;
  /** Absolute URL that opens the instance invite. */
  acceptUrl: string;
  /** The instance's public name, shown in copy. */
  appName: string;
  /** Locale to render in; defaults to the instance default locale. */
  locale?: string;
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
 * (not to join a household). Branded and rendered in the instance default locale.
 * Inline styles only, a single call-to-action, and the raw link repeated as text.
 */
export async function buildInstanceInviteEmail(params: InstanceInviteEmailParams): Promise<{
  subject: string;
  html: string;
}> {
  const locale = await resolveEmailLocale(params.locale);
  const c = emailCopy(locale);

  const app = escapeHtml(params.appName);
  const inviter = params.inviterName ? escapeHtml(params.inviterName) : null;
  const url = escapeHtml(params.acceptUrl);

  // Subject is plain text (no HTML), so it uses the raw values.
  const subject = params.inviterName
    ? fmt(c.instanceSubjectFrom, { inviter: params.inviterName, app: params.appName })
    : fmt(c.instanceSubjectPlain, { app: params.appName });

  const lead = inviter
    ? fmt(c.instanceLeadFrom, { inviter, app: `<strong>${app}</strong>` })
    : fmt(c.instanceLeadPlain, { app: `<strong>${app}</strong>` });

  const bodyHtml =
    `<p style="margin:0 0 24px;font-size:15px;line-height:1.5;color:#44403c;">${lead}</p>` +
    `<p style="margin:0 0 24px;font-size:15px;line-height:1.5;color:#44403c;">${c.instanceBlurb}</p>`;

  const html = renderBrandedEmail({
    previewText: subject,
    heading: fmt(c.instanceHeading, { app }),
    bodyHtml,
    cta: { label: c.instanceCta, url },
    linkFallbackLabel: c.linkFallback,
    linkUrl: url,
    note: c.expiry,
    footer: fmt(c.footer, { app: params.appName }),
  });

  return { subject, html };
}
