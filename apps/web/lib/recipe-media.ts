import { NextResponse } from "next/server";

import { getObjectStore } from "@norish/shared-server/media/object-store";

const VALID_FILENAME_PATTERN = /^[a-zA-Z0-9_-]+\.[a-zA-Z0-9]+$/;

function validateFilename(filename: string): Response | null {
  if (!filename || !VALID_FILENAME_PATTERN.test(filename)) {
    return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
  }

  if (filename.includes("/") || filename.includes("\\") || filename.includes("..")) {
    return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
  }

  return null;
}

/**
 * Serve one media object (by its store key) as an HTTP response, honouring
 * video range requests. The bytes come from the configured object store
 * (filesystem or S3), so this route is the single gateway for all recipe media
 * whichever backend is in use.
 */
async function serveMediaObject(req: Request, key: string, cacheControl: string) {
  const store = getObjectStore();
  const head = await store.head(key);

  if (!head) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const isVideo = head.contentType.startsWith("video/");

  if (isVideo) {
    const rangeHeader = req.headers.get("range");

    if (rangeHeader) {
      const match = rangeHeader.match(/bytes=(\d*)-(\d*)/);

      if (!match) {
        return new Response("Invalid range", { status: 416 });
      }

      const start = match[1] ? parseInt(match[1], 10) : 0;
      const end = match[2] ? parseInt(match[2], 10) : head.size - 1;

      if (start >= head.size || end >= head.size || start > end) {
        return new Response("Range not satisfiable", {
          status: 416,
          headers: { "Content-Range": `bytes */${head.size}` },
        });
      }

      const ranged = await store.getRange(key, start, end);

      if (!ranged) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }

      return new Response(ranged.stream as unknown as ReadableStream, {
        status: 206,
        headers: {
          "Content-Type": head.contentType,
          "Content-Length": (end - start + 1).toString(),
          "Content-Range": `bytes ${start}-${end}/${head.size}`,
          "Accept-Ranges": "bytes",
          "Cache-Control": cacheControl,
        },
      });
    }

    const object = await store.get(key);

    if (!object) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return new Response(new Uint8Array(object.bytes), {
      headers: {
        "Content-Type": head.contentType,
        "Content-Length": object.size.toString(),
        "Accept-Ranges": "bytes",
        "Cache-Control": cacheControl,
      },
    });
  }

  const object = await store.get(key);

  if (!object) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return new Response(new Uint8Array(object.bytes), {
    headers: {
      "Content-Type": head.contentType,
      "Cache-Control": cacheControl,
    },
  });
}

export async function serveRecipeMedia(
  req: Request,
  recipeId: string,
  filename: string,
  cacheControl: string
) {
  const invalidFilename = validateFilename(filename);

  if (invalidFilename) {
    return invalidFilename;
  }

  return serveMediaObject(req, `recipes/${recipeId}/${filename}`, cacheControl);
}

export async function serveRecipeStepMedia(
  recipeId: string,
  filename: string,
  cacheControl: string
) {
  const invalidFilename = validateFilename(filename);

  if (invalidFilename) {
    return invalidFilename;
  }

  const store = getObjectStore();
  const object = await store.get(`recipes/${recipeId}/steps/${filename}`);

  if (!object) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return new Response(new Uint8Array(object.bytes), {
    headers: {
      "Content-Type": object.contentType,
      "Cache-Control": cacheControl,
    },
  });
}
