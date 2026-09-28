import { NextResponse } from "next/server";

import { readThemeImage } from "@norish/shared-server/media/storage";

export const runtime = "nodejs";

/**
 * Serve a generated discovery-theme tile image without auth, so anonymous
 * visitors and crawlers can load it on the public /discover page.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ filename: string }> }) {
  const { filename } = await params;
  const image = await readThemeImage(filename);

  if (!image) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(image.bytes), {
    headers: {
      "Content-Type": image.contentType,
      "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
    },
  });
}
