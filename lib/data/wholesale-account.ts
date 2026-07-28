import "server-only";

import type { WholesaleAccount, WholesaleMinKind } from "@/lib/wholesale";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Hồ sơ wholesale của user đang đăng nhập (nếu admin gán customer_type = wholesale).
 * Giá sỉ chỉ hiện / áp khi isWholesale + đạt ngưỡng min.
 */
export async function getOwnWholesaleAccount(
  authUserId: string
): Promise<WholesaleAccount | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("customers")
    .select("id, company_name, customer_type, status, wholesale_min_kind, wholesale_min_value")
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  if (!data || data.status !== "active") return null;
  if (data.customer_type !== "wholesale") {
    return {
      customerId: data.id,
      companyName: data.company_name,
      isWholesale: false,
      minKind: null,
      minValue: null
    };
  }

  const kind = data.wholesale_min_kind as WholesaleMinKind | null;
  const raw = data.wholesale_min_value;
  const value =
    raw == null || raw === ""
      ? null
      : typeof raw === "string"
        ? Number.parseFloat(raw)
        : Number(raw);

  return {
    customerId: data.id,
    companyName: data.company_name,
    isWholesale: true,
    minKind: kind === "quantity" || kind === "amount" ? kind : null,
    minValue: typeof value === "number" && Number.isFinite(value) ? value : null
  };
}

/** Map productId → wholesale unit price (chỉ gọi khi user là wholesale). */
export async function getWholesalePriceMap(
  productIds: string[]
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (!productIds.length) return map;

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("products")
    .select(
      "id, product_variants ( retail_price, wholesale_price, is_default, is_active )"
    )
    .in("id", productIds)
    .eq("status", "active");

  type V = {
    retail_price: number | string;
    wholesale_price: number | string | null;
    is_default: boolean;
    is_active: boolean;
  };

  for (const row of data ?? []) {
    const variants = (row.product_variants ?? []) as V[];
    const variant =
      variants.find((v) => v.is_default) ?? variants.find((v) => v.is_active) ?? variants[0];
    if (!variant) continue;
    const retail =
      typeof variant.retail_price === "string"
        ? Number.parseFloat(variant.retail_price)
        : variant.retail_price;
    const wholesale =
      variant.wholesale_price == null || variant.wholesale_price === ""
        ? null
        : typeof variant.wholesale_price === "string"
          ? Number.parseFloat(variant.wholesale_price)
          : variant.wholesale_price;
    const price =
      wholesale != null && Number.isFinite(wholesale) && wholesale >= 0
        ? wholesale
        : Number.isFinite(retail)
          ? retail
          : 0;
    map.set(row.id as string, price);
  }
  return map;
}
