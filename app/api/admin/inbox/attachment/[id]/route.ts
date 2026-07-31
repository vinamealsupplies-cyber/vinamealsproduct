import { NextResponse } from "next/server";
import { getViewer } from "@/lib/auth";
import { createAttachmentDownloadUrl } from "@/lib/email/storage";
import { callerKey, checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";

// Chuyển hướng tới presigned URL sống 2 phút. Không bao giờ trả file trực tiếp
// và không lộ object key ra client.
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const viewer = await getViewer();
  if (!viewer?.canAccessAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!(await checkRateLimit(await callerKey("inbox-attach", viewer.id), RATE_LIMITS.upload))) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const { id } = await context.params;
  const { data } = await createAdminClient()
    .from("email_attachments")
    .select("filename, content_type, object_key")
    .eq("id", id)
    .maybeSingle();

  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const { url } = await createAttachmentDownloadUrl({
      key: data.object_key,
      filename: data.filename,
      contentType: data.content_type
    });
    return NextResponse.redirect(url, { status: 302 });
  } catch {
    return NextResponse.json({ error: "Storage unavailable" }, { status: 503 });
  }
}
