import { NextResponse } from "next/server";

import { readPublicAvatar } from "@norish/shared-server/media/storage";

export const runtime = "nodejs";

/**
 * Serve a public profile avatar (cefiro social) without auth, so anonymous
 * visitors and crawlers can load it on public profiles and share cards.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ filename: string }> }) {
  const { filename } = await params;
  const avatar = await readPublicAvatar(filename);

  if (!avatar) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(avatar.bytes), {
    headers: {
      "Content-Type": avatar.contentType,
      "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
    },
  });
}
