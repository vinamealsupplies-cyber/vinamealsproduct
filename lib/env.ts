export function isSupabaseConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  );
}

export function isSupabaseAdminConfigured() {
  return isSupabaseConfigured() && Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function isR2Configured() {
  return Boolean(
    process.env.CLOUDFLARE_ACCOUNT_ID &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY &&
      process.env.R2_BUCKET &&
      process.env.R2_PUBLIC_BASE_URL
  );
}

/**
 * Bucket RIÊNG cho tài liệu miễn thuế. Tách khỏi bucket ảnh sản phẩm vì bucket
 * ảnh có public base URL, còn tài liệu thuế tuyệt đối không được phục vụ công
 * khai — chỉ admin xem qua presigned URL ngắn hạn.
 */
export function isTaxDocumentStorageConfigured() {
  return Boolean(
    process.env.CLOUDFLARE_ACCOUNT_ID &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY &&
      process.env.R2_DOCUMENTS_BUCKET
  );
}

export function isStreamConfigured() {
  return Boolean(
    process.env.CLOUDFLARE_ACCOUNT_ID &&
      process.env.CLOUDFLARE_STREAM_API_TOKEN
  );
}

export function isLocalDemoMode() {
  return process.env.NODE_ENV !== "production" && process.env.APP_DEMO_MODE === "true";
}
