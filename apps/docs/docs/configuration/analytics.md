---
sidebar_position: 10
title: Analytics
description: Privacy-friendly, cookieless Plausible analytics, proxied first-party.
---

# Analytics

Norish supports **[Plausible](https://plausible.io)** — privacy-friendly,
cookieless analytics that needs no consent banner. It is **off** until you
configure it, and it is served **first-party** (via `next-plausible`'s proxy), so
ad-blockers and privacy browsers cannot block it.

## Enable

Set both variables and redeploy:

```yaml title="docker-compose.yml (environment)"
PLAUSIBLE_DOMAIN: recipes.example.com
PLAUSIBLE_SRC: https://plausible.example.com/js/pa--xxxxxxxx.js
```

| Variable           | Description                                                                                      |
| ------------------ | ------------------------------------------------------------------------------------------------ |
| `PLAUSIBLE_DOMAIN` | Your site's Plausible `data-domain` (the site name as it appears in the Plausible dashboard).    |
| `PLAUSIBLE_SRC`    | Your Plausible instance's per-site script URL. Only its **origin** is used, as the proxy target. |

When both are set, the tracker script is served from your own domain and events
are posted first-party, so nothing is exposed as a recognizable analytics
request. Leave either unset and analytics stays off.

## Verify

Open the site in a browser (a tracker blocker no longer matters) and watch
**Realtime → Current visitors** in your Plausible dashboard.
