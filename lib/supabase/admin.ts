import "server-only";

import { createClient } from "@supabase/supabase-js";
import { isSupabaseAdminConfigured } from "@/lib/env";

export function createAdminClient() {
  if (!isSupabaseAdminConfigured()) {
    throw new Error("Supabase service role is not configured.");
  }

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );
}
