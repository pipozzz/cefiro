import { APP_NAME } from "@norish/shared-server/email/branding";
import { emailCopy, fmt, resolveEmailLocale } from "@norish/shared-server/email/i18n";
import { renderBrandedEmail } from "@norish/shared-server/email/layout";

export interface HouseholdInviteEmailParams {
  householdName: string;
  /** Display name of the person who sent the invite, if known. */
  inviterName: string | null;
  /** Absolute URL that accepts the invite. */
  acceptUrl: string;
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
 * The household invite email — branded and rendered in the instance default
 * locale. Inline styles only, a single clear call-to-action, and the raw link
 * repeated as text for clients that don't render the button.
 */
export async function buildHouseholdInviteEmail(params: HouseholdInviteEmailParams): Promise<{
  subject: string;
  html: string;
}> {
  const locale = await resolveEmailLocale(params.locale);
  const c = emailCopy(locale);

  const household = escapeHtml(params.householdName);
  const inviter = params.inviterName ? escapeHtml(params.inviterName) : null;
  const url = escapeHtml(params.acceptUrl);

  // Subject is plain text (no HTML), so it uses the raw values.
  const subject = params.inviterName
    ? fmt(c.householdSubjectFrom, {
        inviter: params.inviterName,
        household: params.householdName,
        app: APP_NAME,
      })
    : fmt(c.householdSubjectPlain, { household: params.householdName, app: APP_NAME });

  const lead = inviter
    ? fmt(c.householdLeadFrom, { inviter, household: `<strong>${household}</strong>` })
    : fmt(c.householdLeadPlain, { household: `<strong>${household}</strong>` });

  const bodyHtml =
    `<p style="margin:0 0 24px;font-size:15px;line-height:1.5;color:#44403c;">${lead}</p>` +
    `<p style="margin:0 0 24px;font-size:15px;line-height:1.5;color:#44403c;">${c.householdBlurb}</p>`;

  const html = renderBrandedEmail({
    previewText: subject,
    heading: fmt(c.householdHeading, { household }),
    bodyHtml,
    cta: { label: c.householdCta, url },
    linkFallbackLabel: c.linkFallback,
    linkUrl: url,
    note: c.expiry,
    footer: fmt(c.footer, { app: APP_NAME }),
  });

  return { subject, html };
}
