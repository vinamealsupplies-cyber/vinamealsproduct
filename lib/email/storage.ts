import "server-only";

import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// Đính kèm của thư ĐẾN — nguy hiểm hơn tài liệu khách tự nộp, vì bất kỳ ai biết
// địa chỉ support@ đều gửi được file vào đây.
//
// Cùng bucket private với tài liệu miễn thuế nhưng khác prefix (`inbox/`).
// Quy tắc giữ nguyên: tên file sinh bằng UUID (không dùng tên gốc của người
// gửi), không có URL public, luôn ép Content-Disposition: attachment để trình
// duyệt tải về chứ không tự mở — chặn HTML/SVG lách thành trang chạy script
// cùng origin với khu admin.

const DOWNLOAD_URL_TTL_SECONDS = 120;

function inboxClient() {
  if (!process.env.R2_DOCUMENTS_BUCKET || !process.env.CLOUDFLARE_ACCOUNT_ID) {
    throw new Error("Inbox attachment storage is not configured.");
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

/** URL tải đính kèm — chỉ phát cho người trong khu admin, sống 2 phút. */
export async function createAttachmentDownloadUrl(input: {
  key: string;
  filename: string;
  contentType: string;
}) {
  const safeName = input.filename.replace(/[^A-Za-z0-9._-]+/g, "-").slice(0, 80) || "attachment";

  const command = new GetObjectCommand({
    Bucket: process.env.R2_DOCUMENTS_BUCKET!,
    Key: input.key,
    ResponseContentDisposition: `attachment; filename="${safeName}"`,
    // Không trả về content-type gốc: một file .html sẽ được phục vụ như
    // octet-stream, không có cơ hội render.
    ResponseContentType: "application/octet-stream"
  });

  return {
    url: await getSignedUrl(inboxClient(), command, { expiresIn: DOWNLOAD_URL_TTL_SECONDS }),
    expiresInSeconds: DOWNLOAD_URL_TTL_SECONDS
  };
}
