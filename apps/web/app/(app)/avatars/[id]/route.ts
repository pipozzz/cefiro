import { NextResponse } from "next/server";

import { getObjectStore } from "@norish/shared-server/media/object-store";

export const runtime = "nodejs";

const VALID_FILENAME_PATTERN = /^[a-zA-Z0-9_-]+\.[a-zA-Z0-9]+$/;

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // Validate filename format to prevent path traversal
  if (!id || !VALID_FILENAME_PATTERN.test(id)) {
    return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
  }

  // Additional safety: ensure no path separators
  if (id.includes("/") || id.includes("\\") || id.includes("..")) {
    return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
  }

  const object = await getObjectStore().get(`avatars/${id}`);

  if (!object) {
    return NextResponse.json(
      { error: "Not found" },
      { status: 404, headers: { "Cache-Control": "no-store" } }
    );
  }

  return new Response(new Uint8Array(object.bytes), {
    headers: {
      "Content-Type": object.contentType,
      // ADR-0021: every upload mints a new filename, so the content behind a
      // given URL never changes. `private` keeps shared caches out — the
      // route sits behind the auth proxy.
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}
