import fsSync from "fs";
import fs from "fs/promises";
import path from "path";
import type { Readable } from "stream";

import { SERVER_CONFIG } from "@norish/config/env-config-server";

import { serverLogger as log } from "../logger";

/**
 * The media object store: one small seam that both the filesystem (the
 * self-hosted default) and an S3-compatible bucket implement, so the rest of
 * the media layer never touches `fs` or the S3 SDK directly.
 *
 * Objects are addressed by a **key** — a POSIX-style path relative to the media
 * root, exactly the tail of the stored web URL: `/recipes/{id}/{file}` is key
 * `recipes/{id}/{file}`, `/public-avatars/{file}` is key `public-avatars/{file}`.
 * Because the key is the URL tail, switching drivers never changes a stored URL,
 * so the database, OpenGraph images and crawlers are unaffected.
 */
export interface ObjectStore {
  /** Store bytes at `key`, overwriting any existing object. */
  put(key: string, bytes: Buffer, contentType: string): Promise<void>;
  /** Whether an object exists at `key`. */
  exists(key: string): Promise<boolean>;
  /** Read the whole object, or null when it is missing. */
  get(key: string): Promise<{ bytes: Buffer; contentType: string; size: number } | null>;
  /** Size and content type without the body, or null when missing. */
  head(key: string): Promise<{ size: number; contentType: string } | null>;
  /**
   * Stream a byte range `[start, end]` inclusive (for video range requests), or
   * null when the object is missing. `size` is the full object size.
   */
  getRange(
    key: string,
    start: number,
    end: number
  ): Promise<{ stream: Readable; contentType: string; size: number } | null>;
  /** Delete the object at `key`; a missing object is not an error. */
  delete(key: string): Promise<void>;
  /** Delete every object whose key starts with `prefix` (a "directory"). */
  deletePrefix(prefix: string): Promise<void>;
  /** Object keys under `prefix` (in store key-space, prefix included). */
  list(prefix: string): Promise<string[]>;
}

const EXT_CONTENT_TYPE: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".m4v": "video/mp4",
};

/** Best-effort content type from a key's extension; JPEG when unknown. */
function contentTypeForKey(key: string): string {
  return EXT_CONTENT_TYPE[path.extname(key).toLowerCase()] ?? "image/jpeg";
}

/** Normalise a key to forward slashes with no leading slash. */
function normalizeKey(key: string): string {
  return key.replace(/^\/+/, "");
}

// --- Filesystem driver -----------------------------------------------------

class FsObjectStore implements ObjectStore {
  private readonly root: string;

  constructor(root: string) {
    this.root = root;
  }

  /** Resolve a key to an absolute path, refusing traversal outside the root. */
  private pathFor(key: string): string {
    const normalized = normalizeKey(key);
    const abs = path.resolve(this.root, ...normalized.split("/"));
    const rel = path.relative(this.root, abs);

    if (rel.startsWith("..") || path.isAbsolute(rel)) {
      throw new Error(`Unsafe object key: ${key}`);
    }

    return abs;
  }

  async put(key: string, bytes: Buffer): Promise<void> {
    const filePath = this.pathFor(key);

    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, bytes);
  }

  async exists(key: string): Promise<boolean> {
    return fs
      .access(this.pathFor(key))
      .then(() => true)
      .catch(() => false);
  }

  async get(key: string): Promise<{ bytes: Buffer; contentType: string; size: number } | null> {
    try {
      const bytes = await fs.readFile(this.pathFor(key));

      return { bytes, contentType: contentTypeForKey(key), size: bytes.length };
    } catch {
      return null;
    }
  }

  async head(key: string): Promise<{ size: number; contentType: string } | null> {
    try {
      const stat = await fs.stat(this.pathFor(key));

      return { size: stat.size, contentType: contentTypeForKey(key) };
    } catch {
      return null;
    }
  }

  async getRange(
    key: string,
    start: number,
    end: number
  ): Promise<{ stream: Readable; contentType: string; size: number } | null> {
    const head = await this.head(key);

    if (!head) {
      return null;
    }

    const stream = fsSync.createReadStream(this.pathFor(key), { start, end });

    return { stream, contentType: head.contentType, size: head.size };
  }

  async delete(key: string): Promise<void> {
    try {
      await fs.unlink(this.pathFor(key));
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
        throw err;
      }
    }
  }

  async deletePrefix(prefix: string): Promise<void> {
    const dir = this.pathFor(prefix);

    await fs.rm(dir, { recursive: true, force: true });
  }

  async list(prefix: string): Promise<string[]> {
    const normalized = normalizeKey(prefix).replace(/\/+$/, "");

    let entries: import("fs").Dirent[];

    try {
      entries = await fs.readdir(this.pathFor(normalized), { withFileTypes: true });
    } catch {
      return [];
    }

    return entries.filter((e) => e.isFile()).map((e) => `${normalized}/${e.name}`);
  }
}

// --- S3-compatible driver --------------------------------------------------

/** Ensure an endpoint carries a scheme (the AWS SDK wants a full URL). */
function normalizeEndpoint(endpoint: string): string {
  return /^https?:\/\//.test(endpoint) ? endpoint : `https://${endpoint}`;
}

class S3ObjectStore implements ObjectStore {
  // The AWS SDK is imported lazily so an fs instance never loads it.
  private clientPromise: Promise<import("@aws-sdk/client-s3").S3Client> | null = null;

  private readonly bucket: string;

  private readonly prefix: string;

  constructor() {
    const { S3_BUCKET, S3_ENDPOINT, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY } = SERVER_CONFIG;

    if (!S3_ENDPOINT || !S3_BUCKET || !S3_ACCESS_KEY_ID || !S3_SECRET_ACCESS_KEY) {
      throw new Error(
        "STORAGE_DRIVER is 's3' but S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID and " +
          "S3_SECRET_ACCESS_KEY are not all set."
      );
    }

    this.bucket = S3_BUCKET;
    this.prefix = SERVER_CONFIG.S3_PREFIX.replace(/^\/+|\/+$/g, "");
  }

  private async client(): Promise<import("@aws-sdk/client-s3").S3Client> {
    if (!this.clientPromise) {
      this.clientPromise = (async () => {
        const { S3Client } = await import("@aws-sdk/client-s3");

        return new S3Client({
          endpoint: normalizeEndpoint(SERVER_CONFIG.S3_ENDPOINT!),
          region: SERVER_CONFIG.S3_REGION,
          forcePathStyle: SERVER_CONFIG.S3_FORCE_PATH_STYLE,
          credentials: {
            accessKeyId: SERVER_CONFIG.S3_ACCESS_KEY_ID!,
            secretAccessKey: SERVER_CONFIG.S3_SECRET_ACCESS_KEY!,
          },
        });
      })();
    }

    return this.clientPromise;
  }

  /** Full object key inside the bucket, applying the optional prefix. */
  private objectKey(key: string): string {
    const normalized = normalizeKey(key);

    return this.prefix ? `${this.prefix}/${normalized}` : normalized;
  }

  /** Strip the configured bucket prefix back off, to return store-space keys. */
  private stripPrefix(objectKey: string): string {
    return this.prefix && objectKey.startsWith(`${this.prefix}/`)
      ? objectKey.slice(this.prefix.length + 1)
      : objectKey;
  }

  async put(key: string, bytes: Buffer, contentType: string): Promise<void> {
    const client = await this.client();
    const { PutObjectCommand } = await import("@aws-sdk/client-s3");

    await client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: this.objectKey(key),
        Body: bytes,
        ContentType: contentType,
        ContentLength: bytes.length,
      })
    );
  }

  async exists(key: string): Promise<boolean> {
    return (await this.head(key)) !== null;
  }

  async get(key: string): Promise<{ bytes: Buffer; contentType: string; size: number } | null> {
    const client = await this.client();
    const { GetObjectCommand } = await import("@aws-sdk/client-s3");

    try {
      const res = await client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: this.objectKey(key) })
      );

      if (!res.Body) {
        return null;
      }

      const bytes = Buffer.from(await res.Body.transformToByteArray());

      return { bytes, contentType: res.ContentType ?? contentTypeForKey(key), size: bytes.length };
    } catch {
      return null;
    }
  }

  async head(key: string): Promise<{ size: number; contentType: string } | null> {
    const client = await this.client();
    const { HeadObjectCommand } = await import("@aws-sdk/client-s3");

    try {
      const res = await client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: this.objectKey(key) })
      );

      return {
        size: res.ContentLength ?? 0,
        contentType: res.ContentType ?? contentTypeForKey(key),
      };
    } catch {
      return null;
    }
  }

  async getRange(
    key: string,
    start: number,
    end: number
  ): Promise<{ stream: Readable; contentType: string; size: number } | null> {
    const client = await this.client();
    const { GetObjectCommand } = await import("@aws-sdk/client-s3");

    try {
      const res = await client.send(
        new GetObjectCommand({
          Bucket: this.bucket,
          Key: this.objectKey(key),
          Range: `bytes=${start}-${end}`,
        })
      );

      if (!res.Body) {
        return null;
      }

      // `ContentRange` is "bytes start-end/total"; the full size is after the
      // slash. Fall back to the (range) ContentLength if the header is absent.
      const total = res.ContentRange?.split("/")[1];
      const size = total ? Number(total) : (res.ContentLength ?? end - start + 1);

      return {
        stream: res.Body as unknown as Readable,
        contentType: res.ContentType ?? contentTypeForKey(key),
        size,
      };
    } catch {
      return null;
    }
  }

  async delete(key: string): Promise<void> {
    const client = await this.client();
    const { DeleteObjectCommand } = await import("@aws-sdk/client-s3");

    await client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: this.objectKey(key) }));
  }

  async deletePrefix(prefix: string): Promise<void> {
    const client = await this.client();
    const { ListObjectsV2Command, DeleteObjectsCommand } = await import("@aws-sdk/client-s3");
    const listPrefix = this.objectKey(prefix.endsWith("/") ? prefix : `${prefix}/`);
    let continuationToken: string | undefined;

    do {
      const list = await client.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: listPrefix,
          ContinuationToken: continuationToken,
        })
      );

      const keys = (list.Contents ?? [])
        .map((o) => o.Key)
        .filter((k): k is string => !!k)
        .map((Key) => ({ Key }));

      if (keys.length > 0) {
        await client.send(
          new DeleteObjectsCommand({ Bucket: this.bucket, Delete: { Objects: keys } })
        );
      }

      continuationToken = list.IsTruncated ? list.NextContinuationToken : undefined;
    } while (continuationToken);
  }

  async list(prefix: string): Promise<string[]> {
    const client = await this.client();
    const { ListObjectsV2Command } = await import("@aws-sdk/client-s3");
    const listPrefix = this.objectKey(prefix.endsWith("/") ? prefix : `${prefix}/`);
    const keys: string[] = [];
    let continuationToken: string | undefined;

    do {
      const res = await client.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: listPrefix,
          ContinuationToken: continuationToken,
        })
      );

      for (const o of res.Contents ?? []) {
        if (o.Key) {
          keys.push(this.stripPrefix(o.Key));
        }
      }

      continuationToken = res.IsTruncated ? res.NextContinuationToken : undefined;
    } while (continuationToken);

    return keys;
  }
}

// --- Singleton -------------------------------------------------------------

let store: ObjectStore | null = null;

/**
 * The configured media object store (built once). "s3" when `STORAGE_DRIVER`
 * says so, otherwise the local filesystem rooted at `UPLOADS_DIR`.
 */
export function getObjectStore(): ObjectStore {
  if (!store) {
    if (SERVER_CONFIG.STORAGE_DRIVER === "s3") {
      log.info("Media object store: S3-compatible bucket");
      store = new S3ObjectStore();
    } else {
      log.info({ root: SERVER_CONFIG.UPLOADS_DIR }, "Media object store: filesystem");
      store = new FsObjectStore(SERVER_CONFIG.UPLOADS_DIR);
    }
  }

  return store;
}

/** Map a stored web URL (e.g. `/recipes/{id}/{file}`) to its object key. */
export function keyFromWebUrl(url: string): string {
  const [pathname] = url.split("?", 1);

  return normalizeKey(pathname ?? "");
}
