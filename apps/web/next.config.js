import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { withSerwist } from "@serwist/turbopack";
import createNextIntlPlugin from "next-intl/plugin";
import { withPlausibleProxy } from "next-plausible";

import { getNextIntlRequestConfigPath } from "./config/next-intl-request-config-path.js";

// Serve the Plausible tracker + events first-party so ad-blockers can't block
// them. The proxy target is the origin of the configured per-site script URL
// (the self-hosted Plausible host). Off (identity wrapper) when unconfigured.
const plausibleHost = (() => {
  try {
    return process.env.PLAUSIBLE_SRC ? new URL(process.env.PLAUSIBLE_SRC).origin : undefined;
  } catch {
    return undefined;
  }
})();
const withPlausible = plausibleHost
  ? withPlausibleProxy({ customDomain: plausibleHost })
  : (config) => config;

const configDirectory = dirname(fileURLToPath(import.meta.url));
const rootPackageJsonPath = resolve(configDirectory, "../../package.json");
const webPackageJsonPath = resolve(configDirectory, "./package.json");
const workspacePackagesDirectory = resolve(configDirectory, "../../packages");

function readPackageJson(packagePath, fallback) {
  if (!existsSync(packagePath)) {
    return fallback;
  }

  return JSON.parse(readFileSync(packagePath, "utf-8"));
}

function readRootVersionFromEnv() {
  try {
    const report = JSON.parse(process.env.NORISH_VERSION_REPORT_JSON ?? "{}");

    return typeof report.root === "string" ? report.root : "unavailable";
  } catch {
    return "unavailable";
  }
}

const packageJson = readPackageJson(rootPackageJsonPath, {
  version: readRootVersionFromEnv(),
});
const webPackageJson = readPackageJson(webPackageJsonPath, { name: "@norish/web" });
const workspacePackages = Array.from(
  new Set([
    webPackageJson.name,
    ...(existsSync(workspacePackagesDirectory)
      ? readdirSync(workspacePackagesDirectory, { withFileTypes: true })
          .filter((entry) => entry.isDirectory())
          .map((entry) => resolve(workspacePackagesDirectory, entry.name, "package.json"))
          .filter((packagePath) => existsSync(packagePath))
          .map((packagePath) => JSON.parse(readFileSync(packagePath, "utf-8")).name)
          .filter((packageName) => packageName.startsWith("@norish/"))
      : []),
  ])
);

const withNextIntl = createNextIntlPlugin(getNextIntlRequestConfigPath());

export default withPlausible(
  withSerwist(
    withNextIntl({
      output: "standalone",
      transpilePackages: workspacePackages,
      // Keep client-side navigation snappy, especially Back/Forward: without this
      // Next 16 uses staleTimes.dynamic=0, so returning to a dynamic page (e.g.
      // pressing Back out of a recipe to /discover or /library) re-fetches that
      // page's RSC payload from the server every time — the visible "long load".
      // A short reuse window serves the already-rendered segment from the client
      // router cache instead; the persisted TanStack cache still refreshes the
      // data underneath.
      experimental: {
        staleTimes: {
          dynamic: 60,
          static: 180,
        },
      },
      turbopack: {
        root: resolve(configDirectory, "../.."),
      },
      productionBrowserSourceMaps: false,
      allowedDevOrigins: [
        "localhost",
        "192.168.2.13",
        "192.168.2.25",
        "http://mac-mini.local",
        "*.local",
      ],
      devIndicators: false,
      env: {
        NEXT_PUBLIC_APP_VERSION: packageJson.version,
      },
      serverExternalPackages: [
        "pino",
        "pino-pretty",
        "thread-stream",
        "playwright-core",
        "web-push",
      ],
      async rewrites() {
        return {
          // cefiro: pretty public profile URLs — /@handle serves /u/handle.
          beforeFiles: [
            {
              source: "/@:handle",
              destination: "/u/:handle",
            },
          ],
        };
      },
      async headers() {
        return [
          {
            // Safe-everywhere headers, including on the framable embed route.
            source: "/(.*)",
            headers: [
              {
                key: "X-Content-Type-Options",
                value: "nosniff",
              },
              {
                key: "Referrer-Policy",
                value: "strict-origin-when-cross-origin",
              },
            ],
          },
          {
            // Clickjacking protection for every route EXCEPT the recipe embed
            // (`/r/<slug>/embed`), which is intentionally framable so oEmbed `rich`
            // consumers can iframe it. That route is a read-only, auth-free card
            // with no actions, and it sends its own `frame-ancestors *` CSP; every
            // other path keeps `DENY`. See app/r/[slug]/embed/route.ts.
            source: "/((?!r/[^/]+/embed$).*)",
            headers: [
              {
                key: "X-Frame-Options",
                value: "DENY",
              },
            ],
          },
          {
            // @serwist/turbopack serves the worker from a Route Handler rather
            // than public/, so the path is /serwist/sw.js and the handler owns
            // Content-Type + Service-Worker-Allowed. Only the policy headers
            // stay here; re-declaring Content-Type would fight the handler.
            source: "/serwist/:path*",
            headers: [
              {
                key: "Cache-Control",
                value: "no-cache, no-store, must-revalidate",
              },
              {
                key: "Content-Security-Policy",
                value: "default-src 'self'; script-src 'self'",
              },
            ],
          },
        ];
      },
    })
  )
);
