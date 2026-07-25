import "server-only";

import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { isTaxDocumentStorageConfigured } from "@/lib/env";
import type { CheckedFile } from "@/lib/tax-exemption/file-guard";

// Lưu tài liệu miễn thuế vào bucket R2 RIÊNG (private, không gắn public domain).
// Nguyên tắc:
//  - Tên file sinh mới bằng UUID, không bao giờ dùng tên gốc của khách.
//  - Không có public URL. Admin xem qua presigned URL sống rất ngắn.
//  - Luôn ép Content-Disposition: attachment để trình duyệt tải về thay vì tự
//    mở/thực thi (chống HTML/SVG lách qua thành trang chạy script cùng origin).

const DOWNLOAD_URL_TTL_SECONDS = 120;

function documentsClient() {
  if (!isTaxDocumentStorageConfigured()) {
    throw new Error("Tax document storage is not configured.");
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

/** `tax-exemptions/<customerId>/<uuid>.<ext>` — khớp CHECK constraint của bảng. */
export function buildDocumentKey(customerId: string, extension: string) {
  return `tax-exemptions/${customerId}/${crypto.randomUUID()}.${extension}`;
}

export async function putTaxDocument(customerId: string, file: CheckedFile) {
  const key = buildDocumentKey(customerId, file.extension);
  await documentsClient().send(
    new PutObjectCommand({
      Bucket: process.env.R2_DOCUMENTS_BUCKET!,
      Key: key,
      Body: file.bytes,
      ContentType: file.contentType,
      // Ngay cả khi ai đó lấy được URL, trình duyệt cũng chỉ tải về.
      ContentDisposition: "attachment",
      CacheControl: "private, no-store"
    })
  );
  return { key, contentType: file.contentType, bytes: file.size };
}

/** URL xem tài liệu, chỉ phát hành cho admin và hết hạn sau 2 phút. */
export async function createTaxDocumentDownloadUrl(input: {
  key: string;
  filename?: string | null;
  contentType: string;
}) {
  const safeName = (input.filename ?? "tax-document")
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
