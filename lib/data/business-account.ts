import "server-only";

import type { BusinessAccount } from "@/lib/business-order";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Business account for offline discount orders.
 * Uses customer_type = 'wholesale' (legacy DB value) OR wholesale_status = approved
 * as “business eligible” — no longer unlocks SKU wholesale_price.
 */
export async function getOwnBusinessAccount(
  authUserId: string
): Promise<BusinessAccount | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("customers")
    .select(
      "id, company_name, customer_type, status, wholesale_status, business_discount_percent"
    )
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  if (!data || data.status !== "active") return null;

  const isBusiness =
    data.customer_type === "wholesale" ||
    data.wholesale_status === "approved";

  const raw = data.business_discount_percent;
  const discount =
    raw == null || raw === ""
      ? null
      : typeof raw === "string"
        ? Number.parseFloat(raw)
        : Number(raw);

  return {
    customerId: data.id,
    companyName: data.company_name,
    isBusiness,
    discountPercent:
      typeof discount === "number" && Number.isFinite(discount) && discount > 0
        ? Math.min(100, discount)
        : null
  };
}
