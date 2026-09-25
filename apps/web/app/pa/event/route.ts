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

// The request headers a reverse proxy / CDN might carry the visitor IP in.
const IP_HEADERS = [
  "cf-connecting-ip",
  "true-client-ip",
  "x-real-ip",
  "x-forwarded-for",
  "forwarded",
  "x-client-ip",
  "x-cluster-client-ip",
] as const;

/**
 * Diagnostic: `GET /pa/event?whoami=1` returns the IP-related request headers as
 * this server actually receives them, plus the IP the proxy would resolve. It
 * reveals only the caller's own request headers. Use it to find which header
 * carries the real visitor IP in a given deployment, then remove it.
 */
export async function GET(request: NextRequest): Promise<Response> {
  if (request.nextUrl.searchParams.get("whoami") !== "1") {
    return new Response("", { status: 404 });
  }

  const headers = Object.fromEntries(IP_HEADERS.map((name) => [name, request.headers.get(name)]));

  return Response.json(
    { resolvedIp: clientIp(request), headers },
    { headers: { "Cache-Control": "no-store" } }
  );
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
      // Plausible reads the client IP from the left-most X-Forwarded-For entry, so
      // send exactly the resolved visitor IP (not a chain that a CDN may reorder).
      ...(ip ? { "X-Forwarded-For": ip } : {}),
    },
    body,
  });

  return new Response(await upstream.text(), {
    status: upstream.status,
    headers: { "Content-Type": upstream.headers.get("content-type") ?? "text/plain" },
  });
}
