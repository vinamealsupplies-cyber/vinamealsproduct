import "server-only";

import {
  defaultStoreBusinessProfile,
  normalizeStoreProfile,
  STORE_PROFILE_SETTING_KEY,
  toStoreProfileView,
  type StoreBusinessProfile,
  type StoreProfile
} from "@/lib/store-profile";
import { createAdminClient } from "@/lib/supabase/admin";

export async function getStoreBusinessProfile(): Promise<StoreBusinessProfile> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("app_settings")
      .select("value")
      .eq("key", STORE_PROFILE_SETTING_KEY)
      .maybeSingle();
    if (error || !data?.value) return defaultStoreBusinessProfile();
    const value = data.value as Partial<StoreBusinessProfile>;
    return normalizeStoreProfile(value);
  } catch {
    return defaultStoreBusinessProfile();
  }
}

export async function getStoreProfileFromDb(): Promise<StoreProfile> {
  const p = await getStoreBusinessProfile();
  return toStoreProfileView(p);
}

export async function saveStoreBusinessProfile(
  profile: StoreBusinessProfile,
  updatedBy: string | null
): Promise<{ ok: true } | { ok: false; error: string }> {
  const normalized = normalizeStoreProfile(profile);
  if (!normalized.legalName.trim()) {
    return { ok: false, error: "Legal business name is required." };
  }

  const admin = createAdminClient();
  const { error } = await admin.from("app_settings").upsert(
    {
      key: STORE_PROFILE_SETTING_KEY,
      value: normalized,
      is_public: false,
      description:
        "Seller business identity + Zelle/check/bank details shown on customer invoices",
      updated_by: updatedBy,
      updated_at: new Date().toISOString()
    },
    { onConflict: "key" }
  );

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
