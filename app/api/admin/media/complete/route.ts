import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStaffApi } from "@/lib/auth";
import { isR2Configured, isSupabaseAdminConfigured } from "@/lib/env";
import { inspectImageObject, publicUrlForObjectKey } from "@/lib/r2";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  productId: z.string().uuid(),
  objectKey: z.string().min(1).max(500),
  contentType: z.enum(["image/jpeg", "image/png", "image/webp", "image/avif"]),
  bytes: z.number().int().positive().max(8 * 1024 * 1024),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  altText: z.string().max(240).optional().default(""),
  position: z.number().int().min(1).max(10),
  isPrimary: z.boolean().default(false)
});

export async function POST(request: Request) {
  const access = await requireStaffApi("manager");
  if (!access.ok) return access.response;
  if (!isR2Configured() || !isSupabaseAdminConfigured()) return NextResponse.json({ error: { code: "MEDIA_NOT_CONFIGURED", message: "R2 and the Supabase service role must be configured." } }, { status: 503 });

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: { code: "INVALID_MEDIA", message: "Invalid media completion request.", details: parsed.error.flatten() } }, { status: 400 });
  const input = parsed.data;
  if (!input.objectKey.startsWith(`products/${input.productId}/images/`)) return NextResponse.json({ error: { code: "INVALID_OBJECT_KEY", message: "The object key does not belong to this product." } }, { status: 400 });

  let storedObject: Awaited<ReturnType<typeof inspectImageObject>>;
  try {
    storedObject = await inspectImageObject(input.objectKey);
  } catch {
    return NextResponse.json({ error: { code: "OBJECT_NOT_FOUND", message: "The uploaded R2 object could not be verified." } }, { status: 400 });
  }
  if (storedObject.bytes <= 0 || storedObject.bytes > 8 * 1024 * 1024) return NextResponse.json({ error: { code: "INVALID_OBJECT_SIZE", message: "The stored image must be between 1 byte and 8 MB." } }, { status: 413 });
  if (storedObject.contentType !== input.contentType) return NextResponse.json({ error: { code: "CONTENT_TYPE_MISMATCH", message: "The stored object content type does not match the upload request." } }, { status: 400 });

  const supabase = createAdminClient();
  const { count, error: countError } = await supabase.from("product_media").select("id", { count: "exact", head: true }).eq("product_id", input.productId).eq("media_type", "image");
  if (countError) return NextResponse.json({ error: { code: "DATABASE_ERROR", message: countError.message } }, { status: 500 });
  if ((count ?? 0) >= 10) return NextResponse.json({ error: { code: "IMAGE_LIMIT_REACHED", message: "A product can have at most 10 images." } }, { status: 409 });

  const { data, error } = await supabase.rpc("admin_complete_product_image", {
    p_product_id: input.productId,
    p_object_key: input.objectKey,
    p_public_url: publicUrlForObjectKey(input.objectKey),
    p_content_type: input.contentType,
    p_bytes: storedObject.bytes,
    p_width: input.width ?? null,
    p_height: input.height ?? null,
    p_alt_text: input.altText,
    p_position: input.position,
    p_is_primary: input.isPrimary,
    p_created_by: access.viewer.demo ? null : access.viewer.id
  }).single();
  if (error) return NextResponse.json({ error: { code: "DATABASE_ERROR", message: error.message } }, { status: 500 });
  return NextResponse.json({ data });
}
