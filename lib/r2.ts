import "server-only";

import { HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { isR2Configured } from "@/lib/env";

function r2Client() {
  if (!isR2Configured()) throw new Error("Cloudflare R2 is not configured.");
  return new S3Client({
    region: "auto",
    endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!
    }
  });
}

export function sanitizeFilename(filename: string) {
  const dot = filename.lastIndexOf(".");
  const base = dot >= 0 ? filename.slice(0, dot) : filename;
  const extension = dot >= 0 ? filename.slice(dot).toLowerCase() : "";
  const safeBase = base.normalize("NFKD").replace(/[^a-zA-Z0-9-_]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
  return `${safeBase || "upload"}${extension}`;
}

export function publicUrlForObjectKey(key: string) {
  if (!isR2Configured()) throw new Error("Cloudflare R2 is not configured.");
  const baseUrl = process.env.R2_PUBLIC_BASE_URL!.replace(/\/$/, "");
  const encodedKey = key.split("/").map(encodeURIComponent).join("/");
  return `${baseUrl}/${encodedKey}`;
}

export async function createImageUpload(input: { productId: string; filename: string; contentType: string }) {
  const key = `products/${input.productId}/images/${crypto.randomUUID()}-${sanitizeFilename(input.filename)}`;
  const cacheControl = "public, max-age=31536000, immutable";
  const command = new PutObjectCommand({
    Bucket: process.env.R2_BUCKET!,
    Key: key,
    ContentType: input.contentType,
    CacheControl: cacheControl
  });
  const uploadUrl = await getSignedUrl(r2Client(), command, {
    expiresIn: 300,
    signableHeaders: new Set(["content-type", "cache-control"])
  });
  return {
    key,
    uploadUrl,
    publicUrl: publicUrlForObjectKey(key),
    expiresInSeconds: 300,
    requiredHeaders: {
      "Content-Type": input.contentType,
      "Cache-Control": cacheControl
    }
  };
}


export async function inspectImageObject(key: string) {
  const response = await r2Client().send(new HeadObjectCommand({
    Bucket: process.env.R2_BUCKET!,
    Key: key
  }));

  return {
    bytes: response.ContentLength ?? 0,
    contentType: response.ContentType ?? "application/octet-stream",
    cacheControl: response.CacheControl ?? null
  };
}
