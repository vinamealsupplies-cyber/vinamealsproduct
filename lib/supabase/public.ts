import "server-only";

import { createClient } from "@supabase/supabase-js";
import { isSupabaseConfigured } from "@/lib/env";

// Client đọc dữ liệu công khai (role anon) — KHÔNG dùng cookie/session, an toàn
// cho server components và catalog. RLS chỉ cho đọc active products/categories/
// variants/media, đủ cho storefront. Stock lấy qua view v_product_listing.
export function createPublicClient() {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is not configured.");
  }
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
