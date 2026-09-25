import type { NextRequest } from "next/server";
import { plausibleOrigin } from "@/lib/plausible-proxy";

// First-party Plausible event sink: the tracker posts here (data-api="/pa/event")
// and we forward to the instance, carrying the real visitor IP + User-Agent so
// Plausible attributes country/uniqueness correctly.
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest): Promise<Response> {
  const origin = plausibleOrigin();

  if (!origin) return new Response("", { status: 404 });

  const body = await request.text();
  const ip = (request.headers.get("x-forwarded-for") ?? "").split(",")[0]?.trim();

  const upstream = await fetch(`${origin}/api/event`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": request.headers.get("user-agent") ?? "",
      ...(ip ? { "X-Forwarded-For": ip } : {}),
    },
    body,
  });

  return new Response(await upstream.text(), {
    status: upstream.status,
    headers: { "Content-Type": upstream.headers.get("content-type") ?? "text/plain" },
  });
}
