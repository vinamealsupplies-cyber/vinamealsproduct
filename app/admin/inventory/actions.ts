"use server";

import { revalidatePath } from "next/cache";
import { getViewer } from "@/lib/auth";
import { callerKey, checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMovementsForVariant, type MovementRow } from "@/lib/data/inventory";
import type { AdminFormState } from "@/lib/data/admin-form";

// Điều chỉnh tồn kho.
//
// Số lượng KHÔNG được sửa trực tiếp vào inventory_balances: thiết kế của DB là
// sổ cái (ledger) — mỗi thay đổi phải là một dòng inventory_movements bất biến,
// trigger sẽ tự cộng/trừ vào balance. Nhờ vậy mọi con số đều giải thích được.
// Riêng reorder point là tham số cấu hình nên cập nhật thẳng.

function fail(message: string): AdminFormState {
  return { status: "error", message };
}

async function guard(scope: string) {
  const viewer = await getViewer();
  if (!viewer?.isStaff) return { viewer: null, error: fail("Staff access is required.") };
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
  if (!viewer?.isStaff) return { ok: false, message: "Staff access is required." };
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

  revalidatePath("/admin/inventory");
  revalidatePath("/admin");
  revalidatePath("/products");
  revalidatePath("/", "layout");

  const sign = delta > 0 ? "+" : "";
  return { status: "success", message: `Adjusted ${sku || "item"} by ${sign}${delta}.` };
}

export async function updateReorderPointAction(
  _prev: AdminFormState,
  formData: FormData
): Promise<AdminFormState> {
  const { error: denied } = await guard("admin-inventory");
  if (denied) return denied;

  const variantId = String(formData.get("variantId") ?? "").trim();
  const locationId = String(formData.get("locationId") ?? "").trim();
  const reorderPoint = Number.parseFloat(String(formData.get("reorderPoint") ?? ""));

  if (!variantId || !locationId) return fail("Missing inventory row.");
  if (!Number.isFinite(reorderPoint) || reorderPoint < 0) return fail("Reorder point must be 0 or more.");

  const { error } = await createAdminClient()
    .from("inventory_balances")
    .update({ reorder_point: reorderPoint })
    .eq("variant_id", variantId)
    .eq("location_id", locationId);

  if (error) return fail(error.message);

  revalidatePath("/admin/inventory");
  revalidatePath("/admin");
  return { status: "success", message: `Reorder point set to ${reorderPoint}.` };
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
  const { error: denied } = await guard("admin-inventory");
  if (denied) return denied;

  const variantId = String(formData.get("variantId") ?? "").trim();
  const sku = String(formData.get("sku") ?? "").trim();
  const costPrice = Number.parseFloat(String(formData.get("costPrice") ?? ""));
  const retailPrice = Number.parseFloat(String(formData.get("retailPrice") ?? ""));

  if (!variantId) return fail("Missing inventory row.");
  if (!Number.isFinite(costPrice) || costPrice < 0) {
    return fail("Unit cost (giá nhập) must be 0 or more.");
  }
  if (!Number.isFinite(retailPrice) || retailPrice < 0) {
    return fail("Retail price (giá bán) must be 0 or more.");
  }

  const { error } = await createAdminClient()
    .from("product_variants")
    .update({
      cost_price: costPrice,
      retail_price: retailPrice
    })
    .eq("id", variantId);

  if (error) return fail(error.message);

  revalidatePath("/admin/inventory");
  revalidatePath("/admin/products");
  revalidatePath("/admin");
  revalidatePath("/products");
  revalidatePath("/", "layout");

  return {
    status: "success",
    message: `Updated pricing for ${sku || "item"}: cost $${costPrice.toFixed(2)}, retail $${retailPrice.toFixed(2)}.`
  };
}
