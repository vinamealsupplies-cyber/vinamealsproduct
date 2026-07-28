"use server";

import { revalidatePath } from "next/cache";
import { getViewer } from "@/lib/auth";
import { callerKey, checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";

// Seller (hoặc staff) xác nhận khách đã tới lấy hàng. Đặt picked_up_at + chuyển
// đơn sang fulfilled. Chỉ áp cho đơn pickup.

export type PickupResult = { ok: true } | { ok: false; error: string };

export async function confirmPickup(orderId: string): Promise<PickupResult> {
  const viewer = await getViewer();
  if (!viewer?.canAccessAdmin) return { ok: false, error: "Bạn không có quyền thao tác." };
  if (!orderId) return { ok: false, error: "Thiếu mã đơn." };
  if (!(await checkRateLimit(await callerKey("confirm-pickup", viewer.id), RATE_LIMITS.mutation))) {
    return { ok: false, error: "Thao tác quá nhanh. Đợi một chút rồi thử lại." };
  }

  const supabase = createAdminClient();
  const now = new Date().toISOString();

  // pickup_ready_at = now thoả ràng buộc picked_up_at >= pickup_ready_at.
  // Chỉ cập nhật đơn pickup đang confirmed và chưa lấy (idempotent, tránh ghi đè
  // đơn đã hoàn tất/huỷ).
  const { data, error } = await supabase
    .from("sales_orders")
    .update({ picked_up_at: now, pickup_ready_at: now, status: "fulfilled", fulfilled_at: now })
    .eq("id", orderId)
    .eq("fulfillment_method", "pickup")
    .eq("status", "confirmed")
    .is("picked_up_at", null)
    .select("id");

  if (error) return { ok: false, error: "Không cập nhật được đơn. Thử lại." };
  if (!data || data.length === 0) {
    return { ok: false, error: "Đơn không ở trạng thái chờ pickup (có thể đã xác nhận trước đó)." };
  }

  revalidatePath("/admin/orders");
  return { ok: true };
}
