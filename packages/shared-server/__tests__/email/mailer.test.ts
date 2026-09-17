import { beforeEach, describe, expect, it, vi } from "vitest";

const sendMailMock = vi.fn();
const createTransportMock = vi.fn(() => ({ sendMail: sendMailMock }));

vi.mock("nodemailer", () => ({
  default: { createTransport: createTransportMock },
}));

type ConfigOverrides = Partial<{
  SMTP_HOST: string | undefined;
  SMTP_PORT: number;
  SMTP_SECURE: boolean;
  SMTP_USER: string | undefined;
  SMTP_PASSWORD: string | undefined;
  EMAIL_FROM: string | undefined;
}>;

function mockConfig(overrides: ConfigOverrides) {
  vi.doMock("@norish/config/env-config-server", () => ({
    SERVER_CONFIG: {
      SMTP_HOST: undefined,
      SMTP_PORT: 587,
      SMTP_SECURE: false,
      SMTP_USER: undefined,
      SMTP_PASSWORD: undefined,
      EMAIL_FROM: undefined,
      ...overrides,
    },
  }));
}

async function loadMailer() {
  return import("@norish/shared-server/email/mailer");
}

describe("mailer", () => {
  beforeEach(() => {
    vi.resetModules();
    sendMailMock.mockReset();
    createTransportMock.mockClear();
  });

  it("skips sending when email is not configured", async () => {
    mockConfig({});
    const { sendEmail, isEmailConfigured } = await loadMailer();

    expect(isEmailConfigured()).toBe(false);

    const result = await sendEmail({ to: "guest@example.com", subject: "Hi", html: "<p>x</p>" });

    expect(result).toEqual({ sent: false, skipped: true });
    expect(createTransportMock).not.toHaveBeenCalled();
    expect(sendMailMock).not.toHaveBeenCalled();
  });

  it("treats a host without a From address as not configured", async () => {
    mockConfig({ SMTP_HOST: "smtp.example.com" });
    const { isEmailConfigured } = await loadMailer();

    expect(isEmailConfigured()).toBe(false);
  });

  it("sends via SMTP when configured and derives a text part from the html", async () => {
    mockConfig({
      SMTP_HOST: "smtp.example.com",
      EMAIL_FROM: "Cefiro <no-reply@example.com>",
      SMTP_USER: "user",
      SMTP_PASSWORD: "pass",
    });
    sendMailMock.mockResolvedValue({ messageId: "abc-123" });
    const { sendEmail, isEmailConfigured } = await loadMailer();

    expect(isEmailConfigured()).toBe(true);

    const result = await sendEmail({
      to: "guest@example.com",
      subject: "Invite",
      html: "<p>Join <b>now</b></p>",
    });

    expect(createTransportMock).toHaveBeenCalledWith(
      expect.objectContaining({
        host: "smtp.example.com",
        port: 587,
        secure: false,
        auth: { user: "user", pass: "pass" },
      })
    );
    expect(sendMailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "Cefiro <no-reply@example.com>",
        to: "guest@example.com",
        subject: "Invite",
        html: "<p>Join <b>now</b></p>",
        text: "Join now",
      })
    );
    expect(result).toEqual({ sent: true, messageId: "abc-123" });
  });

  it("omits SMTP auth when no user is configured", async () => {
    mockConfig({ SMTP_HOST: "relay.internal", EMAIL_FROM: "ops@example.com" });
    sendMailMock.mockResolvedValue({ messageId: "m" });
    const { sendEmail } = await loadMailer();

    await sendEmail({ to: "guest@example.com", subject: "s", html: "<p>hi</p>" });

    expect(createTransportMock).toHaveBeenCalledWith(expect.objectContaining({ auth: undefined }));
  });
});
