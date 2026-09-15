import type { MetadataRoute } from "next";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

async function siteOrigin(): Promise<string> {
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("x-forwarded-host") ?? h.get("host");

  return host ? `${proto}://${host}` : "";
}

export default async function robots(): Promise<MetadataRoute.Robots> {
  const base = await siteOrigin();

  return {
    rules: [
      {
        userAgent: "*",
        // Public, shareable surfaces are crawlable; the authenticated app,
        // API and auth pages are not.
        allow: ["/", "/r/", "/u/", "/discover"],
        disallow: [
          "/api/",
          "/login",
          "/signup",
          "/settings",
          "/profile",
          "/notifications",
          "/feed",
          "/groceries",
          "/calendar",
          "/cookbooks",
          "/recipes/",
        ],
      },
    ],
    sitemap: base ? `${base}/sitemap.xml` : undefined,
    host: base || undefined,
  };
}
