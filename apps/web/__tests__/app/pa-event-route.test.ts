// @vitest-environment node

import { NextRequest } from "next/server";
import { POST } from "@/app/pa/event/route";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/plausible-proxy", () => ({
  plausibleOrigin: () => "https://plausible.example.com",
}));

function eventRequest(headers: Record<string, string>) {
  return new NextRequest("https://recipes.example.com/pa/event", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify({ n: "pageview", u: "https://recipes.example.com/", d: "example" }),
  });
}

describe("POST /pa/event", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("forwards the visitor IP as X-Plausible-IP, which Plausible reads first", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("ok", { status: 202 }));

    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(
      eventRequest({ "x-forwarded-for": "109.236.112.185, 10.0.0.2", "user-agent": "UA" })
    );

    expect(response.status).toBe(202);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;

    expect(url).toBe("https://plausible.example.com/api/event");
    expect(headers["X-Plausible-IP"]).toBe("109.236.112.185");
    expect(headers["X-Forwarded-For"]).toBe("109.236.112.185");
    expect(headers["User-Agent"]).toBe("UA");
  });

  it("prefers the CDN's client header over X-Forwarded-For", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("ok", { status: 202 }));

    vi.stubGlobal("fetch", fetchMock);

    await POST(
      eventRequest({ "cf-connecting-ip": "109.236.112.185", "x-forwarded-for": "1.2.3.4" })
    );

    const headers = (fetchMock.mock.calls[0] as [string, RequestInit])[1].headers as Record<
      string,
      string
    >;

    expect(headers["X-Plausible-IP"]).toBe("109.236.112.185");
  });
});
