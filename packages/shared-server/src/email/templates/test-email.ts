import { APP_NAME } from "@norish/shared-server/email/branding";
import { emailCopy, fmt, resolveEmailLocale } from "@norish/shared-server/email/i18n";
import { renderBrandedEmail } from "@norish/shared-server/email/layout";

/**
 * The admin "send test email" message — branded and rendered in the instance
 * default locale, so an admin verifies both SMTP delivery and the branding at once.
 */
export async function buildTestEmail(locale?: string): Promise<{ subject: string; html: string }> {
  const resolved = await resolveEmailLocale(locale);
  const c = emailCopy(resolved);

  const subject = fmt(c.testSubject, { app: APP_NAME });
  const bodyHtml = `<p style="margin:0;font-size:15px;line-height:1.5;color:#44403c;">${fmt(
    c.testBody,
    { app: `<strong>${APP_NAME}</strong>` }
  )}</p>`;

  const html = renderBrandedEmail({
    previewText: subject,
    heading: c.testHeading,
    bodyHtml,
    footer: fmt(c.footer, { app: APP_NAME }),
  });

  return { subject, html };
}
