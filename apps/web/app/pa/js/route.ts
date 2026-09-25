import { plausibleOrigin } from "@/lib/plausible-proxy";

// First-party Plausible tracker: streams the instance's classic script from our
// own domain, so ad-blockers (which match the analytics host) can't block it.
// The script honours the `data-domain` / `data-api` attributes set on the tag.
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const origin = plausibleOrigin();

  if (!origin) return new Response("", { status: 404 });

  const upstream = await fetch(`${origin}/js/script.js`, {
    // Cache the tracker on the CDN/browser; it changes rarely.
    next: { revalidate: 86_400 },
  });

  if (!upstream.ok) return new Response("", { status: 502 });

  return new Response(await upstream.text(), {
    status: 200,
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=86400, must-revalidate",
    },
  });
}
