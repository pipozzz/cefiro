import { getDefaultLocale } from "@norish/shared-server/config/server-config-loader";

/**
 * Localized copy for outbound emails.
 *
 * Emails are sent outside any request, so there is no reader locale to honour;
 * they render in the instance's default locale (admin-configured, or the
 * `DEFAULT_LOCALE` env fallback). The strings live here rather than in the shared
 * i18n catalogue because they are server-only and must not ship to the client
 * bundle. English is the universal fallback; add a locale by adding an entry.
 */
export interface EmailCopy {
  // Household invite
  householdSubjectFrom: string; // {inviter}, {household}, {app}
  householdSubjectPlain: string; // {household}, {app}
  householdHeading: string; // {household}
  householdLeadFrom: string; // {inviter}, {household}
  householdLeadPlain: string; // {household}
  householdBlurb: string;
  householdCta: string;
  // Instance invite
  instanceSubjectFrom: string; // {inviter}, {app}
  instanceSubjectPlain: string; // {app}
  instanceHeading: string; // {app}
  instanceLeadFrom: string; // {inviter}, {app}
  instanceLeadPlain: string; // {app}
  instanceBlurb: string;
  instanceCta: string;
  // Admin test email
  testSubject: string; // {app}
  testHeading: string;
  testBody: string; // {app}
  // Shared chrome
  linkFallback: string;
  expiry: string;
  footer: string; // {app}
}

const en: EmailCopy = {
  householdSubjectFrom: "{inviter} invited you to {household} on {app}",
  householdSubjectPlain: "You're invited to {household} on {app}",
  householdHeading: "Join {household}",
  householdLeadFrom: "{inviter} invited you to join their household {household}.",
  householdLeadPlain: "You've been invited to join the household {household}.",
  householdBlurb: "A household shares recipes, groceries and meal plans. Accept to get in.",
  householdCta: "Accept invite",
  instanceSubjectFrom: "{inviter} invited you to {app}",
  instanceSubjectPlain: "You're invited to {app}",
  instanceHeading: "Join {app}",
  instanceLeadFrom: "{inviter} invited you to create an account on {app}.",
  instanceLeadPlain: "You've been invited to create an account on {app}.",
  instanceBlurb:
    "Set up your own account to discover, save and cook recipes. Accept to get started.",
  instanceCta: "Create my account",
  testSubject: "{app} — test email",
  testHeading: "SMTP is working",
  testBody:
    "This is a test email from {app}. If you received it, your SMTP settings are working. 🎉",
  linkFallback: "Or paste this link into your browser:",
  expiry: "This invite expires in 14 days. If you didn't expect it, you can ignore this email.",
  footer: "Sent by {app}",
};

const sk: EmailCopy = {
  householdSubjectFrom: "{inviter} vás pozval do domácnosti {household} na {app}",
  householdSubjectPlain: "Máte pozvánku do domácnosti {household} na {app}",
  householdHeading: "Pripojte sa k domácnosti {household}",
  householdLeadFrom: "{inviter} vás pozval do svojej domácnosti {household}.",
  householdLeadPlain: "Dostali ste pozvánku do domácnosti {household}.",
  householdBlurb:
    "Domácnosť zdieľa recepty, nákupy a plány jedál. Prijmite pozvánku a pridajte sa.",
  householdCta: "Prijať pozvánku",
  instanceSubjectFrom: "{inviter} vás pozval na {app}",
  instanceSubjectPlain: "Máte pozvánku na {app}",
  instanceHeading: "Pripojte sa na {app}",
  instanceLeadFrom: "{inviter} vás pozval na vytvorenie účtu na {app}.",
  instanceLeadPlain: "Dostali ste pozvánku na vytvorenie účtu na {app}.",
  instanceBlurb:
    "Vytvorte si vlastný účet a objavujte, ukladajte a varte recepty. Prijmite pozvánku a začnite.",
  instanceCta: "Vytvoriť účet",
  testSubject: "{app} — testovací e-mail",
  testHeading: "SMTP funguje",
  testBody: "Toto je testovací e-mail z {app}. Ak vám prišiel, vaše SMTP nastavenia fungujú. 🎉",
  linkFallback: "Alebo skopírujte tento odkaz do prehliadača:",
  expiry: "Pozvánka vyprší o 14 dní. Ak ste ju nečakali, tento e-mail môžete ignorovať.",
  footer: "Odoslané službou {app}",
};

const COPY: Record<string, EmailCopy> = { en, sk };

/**
 * The default locale to render an email in, or `en` if it can't be read. Callers
 * may pass an explicit locale (e.g. a future per-recipient preference); otherwise
 * the instance default is used.
 */
export async function resolveEmailLocale(explicit?: string): Promise<string> {
  if (explicit) return explicit;

  try {
    return await getDefaultLocale();
  } catch {
    return "en";
  }
}

/** Localized email copy for a locale, falling back by base language then to English. */
export function emailCopy(locale: string): EmailCopy {
  return COPY[locale] ?? COPY[locale.split("-")[0]] ?? en;
}

/** Fill `{placeholder}` tokens. Substituted values are never re-scanned. */
export function fmt(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => vars[key] ?? "");
}
