import type { Transporter } from "nodemailer";
import nodemailer from "nodemailer";

import { SERVER_CONFIG } from "@norish/config/env-config-server";
import { serverLogger as log } from "@norish/shared-server/logger";

export interface EmailMessage {
  to: string;
  subject: string;
  /** HTML body. A plain-text part is derived from it when `text` is omitted. */
  html: string;
  text?: string;
}

export interface SendResult {
  /** True when the message was handed to the SMTP transport. */
  sent: boolean;
  /** True when sending was skipped because email is not configured. */
  skipped?: boolean;
  messageId?: string;
}

/**
 * Email is enabled only when a host and a From address are both configured.
 * Callers use this to degrade gracefully (e.g. show a copyable invite link)
 * instead of pretending a mail went out.
 */
export function isEmailConfigured(): boolean {
  return Boolean(SERVER_CONFIG.SMTP_HOST && SERVER_CONFIG.EMAIL_FROM);
}

let cachedTransporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (!isEmailConfigured()) {
    return null;
  }

  if (!cachedTransporter) {
    cachedTransporter = nodemailer.createTransport({
      host: SERVER_CONFIG.SMTP_HOST,
      port: SERVER_CONFIG.SMTP_PORT,
      secure: SERVER_CONFIG.SMTP_SECURE,
      // Only authenticate when a user is configured — some relays (e.g. an
      // internal MTA) accept unauthenticated mail from trusted sources.
      auth: SERVER_CONFIG.SMTP_USER
        ? { user: SERVER_CONFIG.SMTP_USER, pass: SERVER_CONFIG.SMTP_PASSWORD }
        : undefined,
    });
  }

  return cachedTransporter;
}

/** Reset the cached transport — used by tests, and after a config change. */
export function resetMailer(): void {
  cachedTransporter = null;
}

/** Keep the recipient out of logs as plaintext: log only the domain. */
function redactEmail(address: string): string {
  const at = address.lastIndexOf("@");

  return at === -1 ? "***" : `***@${address.slice(at + 1)}`;
}

/** Cheap HTML→text fallback for the plain-text alternative part. */
function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|h[1-6]|li)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Send one email. When email is not configured this is a logged no-op that
 * returns `{ sent: false, skipped: true }` rather than throwing, so an invite
 * flow can still succeed and fall back to a shareable link.
 */
export async function sendEmail(message: EmailMessage): Promise<SendResult> {
  const transporter = getTransporter();

  if (!transporter) {
    log.warn(
      { to: redactEmail(message.to), subject: message.subject },
      "Email is not configured; skipping send"
    );

    return { sent: false, skipped: true };
  }

  const info = await transporter.sendMail({
    from: SERVER_CONFIG.EMAIL_FROM,
    to: message.to,
    subject: message.subject,
    html: message.html,
    text: message.text ?? htmlToText(message.html),
  });

  log.info(
    { to: redactEmail(message.to), subject: message.subject, messageId: info.messageId },
    "Email sent"
  );

  return { sent: true, messageId: info.messageId };
}
