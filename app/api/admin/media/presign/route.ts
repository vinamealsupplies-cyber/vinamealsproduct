import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStaffApi } from "@/lib/auth";
import { isR2Configured } from "@/lib/env";
import { callerKey, checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { createImageUpload } from "@/lib/r2";

const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);
const schema = z.object({
  productId: z.string().uuid(),
  filename: z.string().min(1).max(180),
  contentType: z.string(),
  size: z.number().int().positive().max(8 * 1024 * 1024)
});

export async function POST(request: Request) {
  const access = await requireStaffApi("manager");
  if (!access.ok) return access.response;

  // Mỗi lượt gọi phát hành một URL upload đã ký — giới hạn để tài khoản bị
  // chiếm dụng không thể bơm dữ liệu vào R2 hoặc đội chi phí lưu trữ.
  if (!(await checkRateLimit(await callerKey("presign", access.viewer.id), RATE_LIMITS.upload))) {
    return NextResponse.json(
      { error: { code: "RATE_LIMITED", message: "Too many upload requests. Wait a minute and try again." } },
      { status: 429 }
    );
  }

  if (!isR2Configured()) return NextResponse.json({ error: { code: "R2_NOT_CONFIGURED", message: "Cloudflare R2 is not configured." } }, { status: 503 });

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: { code: "INVALID_UPLOAD", message: "Invalid image upload request.", details: parsed.error.flatten() } }, { status: 400 });
  if (!allowedTypes.has(parsed.data.contentType)) return NextResponse.json({ error: { code: "UNSUPPORTED_MEDIA_TYPE", message: "Use JPEG, PNG, WebP, or AVIF." } }, { status: 415 });

  try {
    const upload = await createImageUpload(parsed.data);
    return NextResponse.json({ data: upload });
  } catch {
    return NextResponse.json(
      { error: { code: "R2_UPLOAD_URL_FAILED", message: "The image upload URL could not be created." } },
      { status: 502 }
    );
  }
}
