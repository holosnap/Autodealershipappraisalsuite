import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "@/env";

/**
 * Photo storage. S3/R2 when S3_BUCKET is set (browser uploads straight to the bucket via a
 * presigned PUT); otherwise a local ./.uploads directory served through our own routes (dev only).
 */
export const storageMode: "s3" | "local" = env.S3_BUCKET ? "s3" : "local";

const KEY_RE = /^appraisals\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|webp)$/;
const LOCAL_ROOT = path.join(process.cwd(), ".uploads");

let s3: S3Client | undefined;
function client() {
  s3 ??= new S3Client({
    region: env.S3_REGION,
    endpoint: env.S3_ENDPOINT,
    credentials:
      env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY
        ? { accessKeyId: env.S3_ACCESS_KEY_ID, secretAccessKey: env.S3_SECRET_ACCESS_KEY }
        : undefined,
  });
  return s3;
}

function localPath(key: string) {
  if (!KEY_RE.test(key)) throw new Error("Invalid storage key");
  return path.join(LOCAL_ROOT, key);
}

export const extFor = (contentType: string) =>
  ({ "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" })[contentType];

export async function getUploadTarget(photoId: string, key: string, contentType: string) {
  if (storageMode === "local") {
    if (process.env.NODE_ENV === "production" && !process.env.ALLOW_LOCAL_STORAGE) {
      // serverless hosts have an ephemeral filesystem: photos would silently vanish
      throw new Error("Photo storage is not configured: set S3_BUCKET (S3 or Cloudflare R2) in production");
    }
    return { url: `/api/photos/${photoId}/upload`, headers: { "content-type": contentType } };
  }
  const url = await getSignedUrl(client(), new PutObjectCommand({ Bucket: env.S3_BUCKET, Key: key, ContentType: contentType }), {
    expiresIn: 600,
  });
  return { url, headers: { "content-type": contentType } };
}

/** Short-lived URL for S3 mode; null in local mode (caller streams the file instead). */
export async function getDownloadUrl(key: string): Promise<string | null> {
  if (storageMode === "local") return null;
  return getSignedUrl(client(), new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: key }), { expiresIn: 300 });
}

export async function writeLocal(key: string, data: Buffer) {
  const p = localPath(key);
  await mkdir(path.dirname(p), { recursive: true });
  await writeFile(p, data);
}

export const readLocal = (key: string) => readFile(localPath(key));

export async function objectExists(key: string): Promise<boolean> {
  try {
    if (storageMode === "local") return (await stat(localPath(key))).isFile();
    await client().send(new HeadObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
    return true;
  } catch {
    return false;
  }
}

export async function removeObject(key: string) {
  try {
    if (storageMode === "local") await rm(localPath(key), { force: true });
    else await client().send(new DeleteObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
  } catch {
    // best effort: an orphaned object is harmless, a failed delete must not block the user
  }
}
