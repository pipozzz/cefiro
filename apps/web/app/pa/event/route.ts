import type { NextRequest } from "next/server";
import { plausibleOrigin } from "@/lib/plausible-proxy";

// First-party Plausible event sink: the tracker posts here (data-api="/pa/event")
// and we forward to the instance, carrying the real visitor IP + User-Agent so
// Plausible attributes country/uniqueness correctly.
export const dynamic = "force-dynamic";

/**
 * The real visitor IP for a proxied event.
 *
 * Behind a CDN (Cloudflare and friends) the original client is NOT the left-most
 * `x-forwarded-for` entry — that can be a CDN/edge address, which is why country
 * stats came out as datacenter locations. The CDN puts the true client in its own
 * header, so those win; `x-forwarded-for`'s left-most entry is the last resort.
 */
function clientIp(request: NextRequest): string {
  const candidates = [
    request.headers.get("cf-connecting-ip"),
    request.headers.get("true-client-ip"),
    request.headers.get("x-real-ip"),
    (request.headers.get("x-forwarded-for") ?? "").split(",")[0],
  ];

  for (const candidate of candidates) {
    const ip = candidate?.trim();

    if (ip) return ip;
  }

  return "";
}

export async function POST(request: NextRequest): Promise<Response> {
  const origin = plausibleOrigin();

  if (!origin) return new Response("", { status: 404 });

  const body = await request.text();
  const ip = clientIp(request);

  const upstream = await fetch(`${origin}/api/event`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": request.headers.get("user-agent") ?? "",
      // Plausible reads X-Plausible-IP before anything else. A reverse proxy in
      // front of the instance (Traefik without trusted IPs) replaces an incoming
      // X-Forwarded-For with our server's address, so geo came out as the
      // datacenter's country; it leaves a custom header alone. X-Forwarded-For
      // stays as the fallback for instances that honour it.
      ...(ip ? { "X-Plausible-IP": ip, "X-Forwarded-For": ip } : {}),
    },
    body,
  });

  return new Response(await upstream.text(), {
    status: upstream.status,
    headers: { "Content-Type": upstream.headers.get("content-type") ?? "text/plain" },
  });
}
