import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStaffApi } from "@/lib/auth";
import { isStreamConfigured, isSupabaseAdminConfigured } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  productId: z.string().uuid(),
  filename: z.string().min(1).max(180),
  maxDurationSeconds: z.number().int().min(1).max(900).default(180)
});

type StreamResponse = { success: boolean; errors?: Array<{ message?: string }>; result?: { uploadURL?: string; uid?: string } };

export async function POST(request: Request) {
  const access = await requireStaffApi("manager");
  if (!access.ok) return access.response;
  if (!isStreamConfigured() || !isSupabaseAdminConfigured()) return NextResponse.json({ error: { code: "STREAM_NOT_CONFIGURED", message: "Cloudflare Stream and the Supabase service role must be configured." } }, { status: 503 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: { code: "INVALID_VIDEO", message: "Invalid video upload request.", details: parsed.error.flatten() } }, { status: 400 });

  const supabase = createAdminClient();
  const { count, error: countError } = await supabase.from("product_media").select("id", { count: "exact", head: true }).eq("product_id", parsed.data.productId).eq("media_type", "video");
  if (countError) return NextResponse.json({ error: { code: "DATABASE_ERROR", message: countError.message } }, { status: 500 });
  if ((count ?? 0) >= 1) return NextResponse.json({ error: { code: "VIDEO_LIMIT_REACHED", message: "Remove or replace the existing product video first." } }, { status: 409 });

  let response: Response;
  let body: StreamResponse;
  try {
    response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/stream/direct_upload`, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.CLOUDFLARE_STREAM_API_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ maxDurationSeconds: parsed.data.maxDurationSeconds, requireSignedURLs: false, meta: { productId: parsed.data.productId, filename: parsed.data.filename, createdBy: access.viewer.id } }),
      cache: "no-store"
    });
    body = await response.json() as StreamResponse;
  } catch {
    return NextResponse.json({ error: { code: "STREAM_UNAVAILABLE", message: "Cloudflare Stream could not be reached." } }, { status: 502 });
  }
  if (!response.ok || !body.success || !body.result?.uploadURL || !body.result.uid) {
    return NextResponse.json({ error: { code: "STREAM_ERROR", message: body.errors?.[0]?.message ?? "Cloudflare Stream did not create an upload URL." } }, { status: 502 });
  }
  const { data: media, error: mediaError } = await supabase.from("product_media").insert({
    product_id: parsed.data.productId,
    media_type: "video",
    provider: "stream",
    status: "pending",
    stream_uid: body.result.uid,
    alt_text: `${parsed.data.filename} product video`,
    position: 1,
    created_by: access.viewer.demo ? null : access.viewer.id
  }).select("id, stream_uid, status").single();
  if (mediaError) return NextResponse.json({ error: { code: "DATABASE_ERROR", message: mediaError.message, streamUid: body.result.uid } }, { status: 500 });

  return NextResponse.json({ data: { uploadUrl: body.result.uploadURL, uid: body.result.uid, media } });
}
