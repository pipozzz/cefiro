---
sidebar_position: 12
title: Web push notifications
description: Browser push notifications for social activity.
---

# Web push notifications

Norish can send **browser push notifications** for social activity — when someone
follows you, or likes, comments on, saves, or reports your recipe. These arrive
in addition to the in-app notification bell. Push is **optional** and off until
VAPID keys are configured.

## Generate VAPID keys

Run once and keep the private key secret:

```bash
npx web-push generate-vapid-keys
```

## Enable

```yaml title="docker-compose.yml (environment)"
VAPID_PUBLIC_KEY: <public-key>
VAPID_PRIVATE_KEY: <private-key>
VAPID_SUBJECT: mailto:admin@example.com
```

| Variable            | Description                                                   | Default                       |
| ------------------- | ------------------------------------------------------------- | ----------------------------- |
| `VAPID_PUBLIC_KEY`  | VAPID public key. Enables push when set with the private key. | —                             |
| `VAPID_PRIVATE_KEY` | VAPID private key. Store as a secret — never commit.          | —                             |
| `VAPID_SUBJECT`     | A `mailto:` or `https:` URL identifying the sender.           | `mailto:admin@nasakuchyna.sk` |

Set the same values on both the `web` and `worker` services.

## Use

Once configured, each user opts in per browser under **Settings → Notifications**,
where a **Send test** button confirms delivery. Without the keys, the toggle is
hidden.

:::note
On macOS, some browsers show the browser's own icon on web-push notifications
rather than the site's — an OS limitation, not a configuration issue.
:::
