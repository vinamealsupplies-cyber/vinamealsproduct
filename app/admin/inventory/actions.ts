"use server";

import { revalidatePath } from "next/cache";
import { getViewer } from "@/lib/auth";
import { writeAuditLog } from "@/lib/data/audit-log";
import { callerKey, checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMovementsForVariant, type MovementRow } from "@/lib/data/inventory";
import type { AdminFormState } from "@/lib/data/admin-form";

// Điều chỉnh tồn kho.
//
// Số lượng KHÔNG được sửa trực tiếp vào inventory_balances: thiết kế của DB là
// sổ cái (ledger) — mỗi thay đổi phải là một dòng inventory_movements bất biến,
// trigger sẽ tự cộng/trừ vào balance. Nhờ vậy mọi con số đều giải thích được.

function fail(message: string): AdminFormState {
  return { status: "error", message };
}

async function guard(scope: string) {
  const viewer = await getViewer();
  // Seller cũng quản lý kho → cho phép staff HOẶC seller (canAccessAdmin).
  if (!viewer?.canAccessAdmin) return { viewer: null, error: fail("Staff access is required.") };
  if (!(await checkRateLimit(await callerKey(scope, viewer.id), RATE_LIMITS.mutation))) {
    return { viewer: null, error: fail("Too many changes in a short time. Wait a minute and try again.") };
  }
  return { viewer, error: null };
}

/**
 * Lịch sử thay đổi của đúng một mặt hàng, kèm tên người thực hiện.
 * Tải theo yêu cầu (khi bấm chọn dòng) thay vì nạp sẵn toàn bộ, để lịch sử
 * luôn đầy đủ cho món đó chứ không bị cắt bởi một danh sách chung.
 */
export async function fetchVariantHistory(
  variantId: string,
  locationId: string
): Promise<{ ok: true; movements: MovementRow[] } | { ok: false; message: string }> {
  const viewer = await getViewer();
  if (!viewer?.canAccessAdmin) return { ok: false, message: "Staff access is required." };
  if (!variantId || !locationId) return { ok: false, message: "Missing inventory row." };

  try {
    return { ok: true, movements: await getMovementsForVariant(variantId, locationId) };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "History unavailable." };
  }
}

export async function adjustInventoryAction(
  _prev: AdminFormState,
  formData: FormData
): Promise<AdminFormState> {
  const { viewer, error: denied } = await guard("admin-inventory");
  if (denied) return denied;

  const variantId = String(formData.get("variantId") ?? "").trim();
  const locationId = String(formData.get("locationId") ?? "").trim();
  const sku = String(formData.get("sku") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 200);
  const mode = String(formData.get("mode") ?? "delta");
  const value = Number.parseFloat(String(formData.get("quantity") ?? ""));
  const currentOnHand = Number.parseFloat(String(formData.get("currentOnHand") ?? "0"));

  if (!variantId || !locationId) return fail("Missing inventory row.");
  if (!Number.isFinite(value)) return fail("Enter a number.");
  if (!reason) return fail("A reason is required so the movement can be audited.");

  // "set" = nhập số đếm thực tế → quy đổi thành chênh lệch so với sổ sách.
  const delta = mode === "set" ? value - currentOnHand : value;
  if (delta === 0) return fail("That would not change the quantity.");
  if (mode === "set" && value < 0) return fail("Counted quantity cannot be negative.");

  const supabase = createAdminClient();
  const { error } = await supabase.from("inventory_movements").insert({
    variant_id: variantId,
    location_id: locationId,
    movement_type: "adjustment",
    quantity_change: delta,
    reason,
    created_by: viewer!.id
  });

  if (error) {
    // Ràng buộc quantity_on_hand >= 0 trên inventory_balances.
    if (error.message.includes("inventory_balances_quantity_check")) {
      return fail("That adjustment would push the quantity below zero (or below the reserved amount).");
    }
    return fail(error.message);
  }

  await writeAuditLog({
    actorUserId: viewer!.id,
    action: "inventory.adjust",
    entityType: "product_variant",
    entityId: variantId,
    before: { onHand: currentOnHand },
    after: { delta, mode, reason, locationId },
    metadata: {
      sku,
      actorRole: viewer!.role,
      actorEmail: viewer!.email
    }
  });

  revalidatePath("/admin/inventory");
  revalidatePath("/admin");
  revalidatePath("/products");
  revalidatePath("/", "layout");

  const sign = delta > 0 ? "+" : "";
  return { status: "success", message: `Adjusted ${sku || "item"} by ${sign}${delta}.` };
}

/**
 * Cập nhật giá nhập (cost) và giá bán (retail) trên product_variants.
 * Giá gắn với SKU/variant, không phụ thuộc kho — đổi một lần áp dụng mọi location.
 * Inventory value = on_hand × cost_price (tính từ view).
 */
export async function updateInventoryPricingAction(
  _prev: AdminFormState,
  formData: FormData
): Promise<AdminFormState> {
  const { viewer, error: denied } = await guard("admin-inventory");
  if (denied) return denied;

  const variantId = String(formData.get("variantId") ?? "").trim();
  const sku = String(formData.get("sku") ?? "").trim();
  const retailPrice = Number.parseFloat(String(formData.get("retailPrice") ?? ""));

  if (!variantId) return fail("Missing inventory row.");
  if (!Number.isFinite(retailPrice) || retailPrice < 0) {
    return fail("Retail price (giá bán) must be 0 or more.");
  }

  const supabase = createAdminClient();
  const { data: before } = await supabase
    .from("product_variants")
    .select("cost_price, retail_price, sku")
    .eq("id", variantId)
    .maybeSingle();

  // Seller không được đổi giá nhập — chỉ staff/manager/admin.
  const nextCost = viewer!.isSeller
    ? Number(before?.cost_price ?? 0)
    : Number.parseFloat(String(formData.get("costPrice") ?? ""));
  if (!viewer!.isSeller && (!Number.isFinite(nextCost) || nextCost < 0)) {
    return fail("Unit cost (giá nhập) must be 0 or more.");
  }

  const { error } = await supabase
    .from("product_variants")
    .update({
      cost_price: nextCost,
      retail_price: retailPrice
    })
    .eq("id", variantId);

  if (error) return fail(error.message);

  await writeAuditLog({
    actorUserId: viewer!.id,
    action: "inventory.update_pricing",
    entityType: "product_variant",
    entityId: variantId,
    before,
    after: { cost_price: nextCost, retail_price: retailPrice, sku },
    metadata: {
      actorRole: viewer!.role,
      actorEmail: viewer!.email,
      costHiddenFromSeller: viewer!.isSeller
    }
  });

  revalidatePath("/admin/inventory");
  revalidatePath("/admin/products");
  revalidatePath("/admin");
  revalidatePath("/products");
  revalidatePath("/", "layout");

  return {
    status: "success",
    message: viewer!.isSeller
      ? `Updated retail price for ${sku || "item"}: $${retailPrice.toFixed(2)}.`
      : `Updated pricing for ${sku || "item"}: cost $${nextCost.toFixed(2)}, retail $${retailPrice.toFixed(2)}.`
  };
}
