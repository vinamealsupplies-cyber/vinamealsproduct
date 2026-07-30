import "server-only";

import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { isTaxDocumentStorageConfigured } from "@/lib/env";
import type { CheckedBusinessFile } from "@/lib/business-application/file-guard";

const DOWNLOAD_URL_TTL_SECONDS = 120;

function documentsClient() {
  if (!isTaxDocumentStorageConfigured()) {
    throw new Error("Document storage is not configured.");
  }
  return new S3Client({
    region: "auto",
    endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!
    }
  });
}

/** `business-applications/<customerId>/<uuid>.<ext>` — matches DB CHECK. */
export function buildBusinessDocumentKey(customerId: string, extension: string) {
  return `business-applications/${customerId}/${crypto.randomUUID()}.${extension}`;
}

export async function putBusinessDocument(customerId: string, file: CheckedBusinessFile) {
  const key = buildBusinessDocumentKey(customerId, file.extension);
  await documentsClient().send(
    new PutObjectCommand({
      Bucket: process.env.R2_DOCUMENTS_BUCKET!,
      Key: key,
      Body: file.bytes,
      ContentType: file.contentType,
      ContentDisposition: "attachment",
      CacheControl: "private, no-store"
    })
  );
  return { key, contentType: file.contentType, bytes: file.size };
}

export async function createBusinessDocumentDownloadUrl(input: {
  key: string;
  filename?: string | null;
  contentType: string;
}) {
  const safeName = (input.filename ?? "application-document")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .slice(0, 80);

  const command = new GetObjectCommand({
    Bucket: process.env.R2_DOCUMENTS_BUCKET!,
    Key: input.key,
    ResponseContentDisposition: `attachment; filename="${safeName}"`,
    ResponseContentType: input.contentType
  });

  return {
    url: await getSignedUrl(documentsClient(), command, { expiresIn: DOWNLOAD_URL_TTL_SECONDS }),
    expiresInSeconds: DOWNLOAD_URL_TTL_SECONDS
  };
}
