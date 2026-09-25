---
sidebar_position: 11
title: Email (SMTP)
description: Send invite emails over SMTP.
---

# Email (SMTP)

Norish can send email — currently household and instance **invites** — over any
SMTP server. Email is **optional**: it is enabled only when both `SMTP_HOST` and
`EMAIL_FROM` are set. When it is off, invite flows fall back to a shareable link
instead of an email.

## Enable

```yaml title="docker-compose.yml (environment)"
SMTP_HOST: smtp.example.com
SMTP_PORT: 587
SMTP_SECURE: "false"
SMTP_USER: apikey
SMTP_PASSWORD: your-smtp-password
EMAIL_FROM: "Naša Kuchyňa <noreply@example.com>"
```

| Variable        | Description                                                          | Default |
| --------------- | -------------------------------------------------------------------- | ------- |
| `SMTP_HOST`     | SMTP server hostname. Required to enable email.                      | —       |
| `SMTP_PORT`     | SMTP port.                                                           | `587`   |
| `SMTP_SECURE`   | `true` for implicit TLS (port 465); `false` for STARTTLS (port 587). | `false` |
| `SMTP_USER`     | Username. Omit for an unauthenticated relay.                         | —       |
| `SMTP_PASSWORD` | Password. Store as a secret — never commit.                          | —       |
| `EMAIL_FROM`    | The `From` address (a bare address or `Name <address>`). Required.   | —       |

Set the same values on both the `web` and `worker` services.
