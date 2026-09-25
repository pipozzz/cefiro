import { APP_NAME, appUrl, BRAND_COLOR, logoUrl } from "@norish/shared-server/email/branding";

export interface BrandedEmailParams {
  /** Hidden preheader shown as the inbox preview snippet. Plain text. */
  previewText: string;
  /** Card heading. Trusted copy (no user HTML). */
  heading: string;
  /** Inner body HTML — paragraphs, already escaped/built by the caller. */
  bodyHtml: string;
  /** Primary call-to-action. `url` must be HTML-escaped by the caller. */
  cta?: { label: string; url: string };
  /** "Or paste this link" label + the (escaped) URL, when a fallback link helps. */
  linkFallbackLabel?: string;
  linkUrl?: string;
  /** Small note under the card, e.g. an expiry line. Trusted copy. */
  note?: string;
  /** Footer tagline. Trusted copy. */
  footer: string;
}

function escapeAttr(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

/**
 * The shared branded email shell: a logo header, a white card with the message,
 * an optional CTA button and copy-paste link, and a footer. Inline styles only
 * (mail clients strip `<style>`), max-width for phones, and a hidden preheader.
 */
export function renderBrandedEmail(p: BrandedEmailParams): string {
  const home = escapeAttr(appUrl());
  const logo = escapeAttr(logoUrl());
  const app = escapeAttr(APP_NAME);

  const ctaHtml = p.cta
    ? `<a href="${p.cta.url}" style="display:inline-block;background:${BRAND_COLOR};color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 22px;border-radius:9999px;">${p.cta.label}</a>`
    : "";

  const linkHtml =
    p.linkFallbackLabel && p.linkUrl
      ? `<p style="margin:24px 0 0;font-size:13px;line-height:1.5;color:#78716c;">${p.linkFallbackLabel}<br /><a href="${p.linkUrl}" style="color:${BRAND_COLOR};word-break:break-all;">${p.linkUrl}</a></p>`
      : "";

  const noteHtml = p.note
    ? `<p style="margin:20px 0 0;font-size:12px;color:#a8a29e;text-align:center;">${p.note}</p>`
    : "";

  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f5f5f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1c1917;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${p.previewText}</div>
    <div style="max-width:520px;margin:0 auto;padding:32px 24px;">
      <div style="text-align:center;margin:0 0 24px;">
        <a href="${home}" style="text-decoration:none;">
          <img src="${logo}" width="48" height="48" alt="${app}" style="display:inline-block;border:0;border-radius:12px;vertical-align:middle;" />
          <span style="display:inline-block;margin-left:10px;font-size:18px;font-weight:700;color:#1c1917;vertical-align:middle;">${app}</span>
        </a>
      </div>
      <div style="background:#ffffff;border-radius:16px;padding:32px;border:1px solid #e7e5e4;">
        <h1 style="margin:0 0 16px;font-size:20px;font-weight:700;">${p.heading}</h1>
        ${p.bodyHtml}
        ${ctaHtml}
        ${linkHtml}
      </div>
      ${noteHtml}
      <p style="margin:16px 0 0;font-size:12px;color:#a8a29e;text-align:center;">${p.footer}</p>
    </div>
  </body>
</html>`;
}
