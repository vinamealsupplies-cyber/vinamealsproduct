"use server";

import { revalidatePath } from "next/cache";
import { getViewer, type Viewer } from "@/lib/auth";
import { writeAuditLog } from "@/lib/data/audit-log";
import { callerKey, checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import {
  buildTrackingUrl,
  isShippingCarrier,
  type ShippingCarrier
} from "@/lib/shipping-tracking";
import { createAdminClient } from "@/lib/supabase/admin";

// Seller/staff: xác nhận giao/pickup, tracking ship, huỷ đơn, ghi chú.

export type OrderActionResult = { ok: true } | { ok: false; error: string };

type OrderSnapshot = {
  id: string;
  order_number: string | null;
  status: string;
  fulfillment_method: string | null;
  notes: string | null;
  picked_up_at: string | null;
  fulfilled_at: string | null;
  total_amount: number | string | null;
  shipping_carrier?: string | null;
  tracking_number?: string | null;
  tracking_url?: string | null;
  shipped_at?: string | null;
  picked_up_by?: string | null;
  picked_up_by_name?: string | null;
};

const ORDER_SELECT =
  "id, order_number, status, fulfillment_method, notes, picked_up_at, fulfilled_at, total_amount, shipping_carrier, tracking_number, tracking_url, shipped_at, picked_up_by, picked_up_by_name";

function actorDisplayName(viewer: Viewer) {
  return viewer.fullName?.trim() || viewer.email?.trim() || viewer.id.slice(0, 8);
}

async function requireOps(): Promise<{ viewer: Viewer } | { error: string }> {
  const viewer = await getViewer();
  if (!viewer?.canAccessAdmin) return { error: "Bạn không có quyền thao tác." };
  if (!(await checkRateLimit(await callerKey("order-ops", viewer.id), RATE_LIMITS.mutation))) {
    return { error: "Thao tác quá nhanh. Đợi một chút rồi thử lại." };
  }
  return { viewer };
}

function revalidateOrders() {
  revalidatePath("/admin/orders");
  revalidatePath("/admin");
  // Khách xem trạng thái trên /account — làm mới sau pickup/giao/huỷ.
  revalidatePath("/account");
}

async function loadOrder(id: string): Promise<OrderSnapshot | null> {
  const supabase = createAdminClient();
  const { data } = await supabase.from("sales_orders").select(ORDER_SELECT).eq("id", id).maybeSingle();
  return (data as OrderSnapshot | null) ?? null;
}

/**
 * Lưu mã vận đơn (ship). Không tự chuyển fulfilled — nhân viên tra cứu FedEx/USPS
 * rồi bấm "Đã giao" khi hàng tới.
 */
export async function saveShipmentTracking(
  orderId: string,
  carrier: string,
  trackingNumber: string,
  customUrl = ""
): Promise<OrderActionResult> {
  const gate = await requireOps();
  if ("error" in gate) return { ok: false, error: gate.error };
  if (!orderId) return { ok: false, error: "Thiếu mã đơn." };

  const carrierCode = carrier.trim().toLowerCase();
  if (!isShippingCarrier(carrierCode)) {
    return { ok: false, error: "Chọn hãng vận chuyển (USPS, FedEx, UPS, DHL, hoặc Other)." };
  }
  const tracking = trackingNumber.trim().slice(0, 80);
  if (!tracking) return { ok: false, error: "Nhập mã số giao hàng (tracking number)." };

  const override = customUrl.trim().slice(0, 500);
  if (override && !/^https?:\/\//i.test(override)) {
    return { ok: false, error: "Link tra cứu tùy chỉnh phải bắt đầu bằng http:// hoặc https://." };
  }

  const before = await loadOrder(orderId);
  if (!before) return { ok: false, error: "Không tìm thấy đơn." };
  if (before.status === "cancelled") return { ok: false, error: "Đơn đã huỷ." };
  if (before.fulfillment_method !== "ship") {
    return { ok: false, error: "Chỉ đơn ship mới có mã vận đơn." };
  }

  const trackingUrl =
    override || buildTrackingUrl(carrierCode as ShippingCarrier, tracking) || null;
  const now = new Date().toISOString();
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("sales_orders")
    .update({
      shipping_carrier: carrierCode,
      tracking_number: tracking,
      tracking_url: trackingUrl,
      shipped_at: before.shipped_at ?? now,
      updated_at: now
    })
    .eq("id", orderId)
    .select(ORDER_SELECT);

  if (error) {
    if (error.message.includes("shipping_carrier") || error.message.includes("tracking_number")) {
      return {
        ok: false,
        error: "Database chưa có cột tracking. Chạy migration 20260728220000_order_shipping_tracking.sql."
      };
    }
    return { ok: false, error: "Không lưu mã vận đơn. Thử lại." };
  }
  if (!data?.length) return { ok: false, error: "Không tìm thấy đơn." };

  const after = data[0] as OrderSnapshot;
  await writeAuditLog({
    actorUserId: gate.viewer.id,
    action: "order.save_tracking",
    entityType: "sales_order",
    entityId: orderId,
    before: {
      shipping_carrier: before.shipping_carrier,
      tracking_number: before.tracking_number
    },
    after: {
      shipping_carrier: after.shipping_carrier,
      tracking_number: after.tracking_number,
      tracking_url: after.tracking_url
    },
    metadata: {
      orderNumber: after.order_number,
      actorRole: gate.viewer.role,
      actorEmail: gate.viewer.email
    }
  });

  revalidateOrders();
  return { ok: true };
}

/** Pickup: khách đã lấy hàng → fulfilled. Ghi tên người xác nhận để kiểm tra. */
export async function confirmPickup(orderId: string): Promise<OrderActionResult> {
  const gate = await requireOps();
  if ("error" in gate) return { ok: false, error: gate.error };
  if (!orderId) return { ok: false, error: "Thiếu mã đơn." };

  const before = await loadOrder(orderId);
  if (!before) return { ok: false, error: "Không tìm thấy đơn." };

  const confirmerName = actorDisplayName(gate.viewer);
  const supabase = createAdminClient();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("sales_orders")
    .update({
      picked_up_at: now,
      pickup_ready_at: now,
      status: "fulfilled",
      fulfilled_at: now,
      picked_up_by: gate.viewer.id,
      picked_up_by_name: confirmerName,
      updated_at: now
    })
    .eq("id", orderId)
    .eq("fulfillment_method", "pickup")
    .eq("status", "confirmed")
    .is("picked_up_at", null)
    .select(ORDER_SELECT);

  if (error) {
    if (error.message.includes("picked_up_by")) {
      return {
        ok: false,
        error: "Database chưa có cột picked_up_by. Chạy migration 20260728230000_pickup_confirmed_by.sql."
      };
    }
    return { ok: false, error: "Không cập nhật được đơn. Thử lại." };
  }
  if (!data || data.length === 0) {
    return { ok: false, error: "Đơn không ở trạng thái chờ pickup (có thể đã xác nhận trước đó)." };
  }

  const after = data[0] as OrderSnapshot;
  await writeAuditLog({
    actorUserId: gate.viewer.id,
    action: "order.confirm_pickup",
    entityType: "sales_order",
    entityId: orderId,
    before,
    after,
    metadata: {
      orderNumber: after.order_number,
      confirmedByName: confirmerName,
      confirmedById: gate.viewer.id,
      actorRole: gate.viewer.role,
      actorEmail: gate.viewer.email
    }
  });

  revalidateOrders();
  return { ok: true };
}

/**
 * Huỷ pickup đã xác nhận → trả đơn về confirmed (chờ pickup lại).
 * Ghi log người huỷ + người đã xác nhận trước đó.
 */
export async function cancelPickup(orderId: string, reason = ""): Promise<OrderActionResult> {
  const gate = await requireOps();
  if ("error" in gate) return { ok: false, error: gate.error };
  if (!orderId) return { ok: false, error: "Thiếu mã đơn." };

  const before = await loadOrder(orderId);
  if (!before) return { ok: false, error: "Không tìm thấy đơn." };
  if (before.fulfillment_method !== "pickup") {
    return { ok: false, error: "Chỉ huỷ pickup cho đơn nhận tại cửa hàng." };
  }
  if (before.status !== "fulfilled" || !before.picked_up_at) {
    return { ok: false, error: "Đơn chưa được xác nhận pickup." };
  }

  const cancelReason = reason.trim().slice(0, 500);
  const cancellerName = actorDisplayName(gate.viewer);
  const now = new Date().toISOString();
  const supabase = createAdminClient();

  // Trả về confirmed để nhân viên có thể pickup lại; xóa mốc + người xác nhận.
  const { data, error } = await supabase
    .from("sales_orders")
    .update({
      status: "confirmed",
      picked_up_at: null,
      fulfilled_at: null,
      // Giữ pickup_ready_at nếu có — đơn vẫn sẵn sàng lấy lại.
      picked_up_by: null,
      picked_up_by_name: null,
      updated_at: now
    })
    .eq("id", orderId)
    .eq("fulfillment_method", "pickup")
    .eq("status", "fulfilled")
    .not("picked_up_at", "is", null)
    .select(ORDER_SELECT);

  if (error) return { ok: false, error: "Không huỷ pickup được. Thử lại." };
  if (!data?.length) {
    return { ok: false, error: "Đơn không còn ở trạng thái đã pickup." };
  }

  const after = data[0] as OrderSnapshot;
  await writeAuditLog({
    actorUserId: gate.viewer.id,
    action: "order.cancel_pickup",
    entityType: "sales_order",
    entityId: orderId,
    before: {
      status: before.status,
      picked_up_at: before.picked_up_at,
      picked_up_by: before.picked_up_by,
      picked_up_by_name: before.picked_up_by_name,
      fulfilled_at: before.fulfilled_at
    },
    after: {
      status: after.status,
      picked_up_at: after.picked_up_at,
      picked_up_by: after.picked_up_by,
      picked_up_by_name: after.picked_up_by_name,
      fulfilled_at: after.fulfilled_at
    },
    metadata: {
      orderNumber: after.order_number,
      reason: cancelReason || null,
      previousConfirmedByName: before.picked_up_by_name,
      previousConfirmedById: before.picked_up_by,
      cancelledByName: cancellerName,
      cancelledById: gate.viewer.id,
      actorRole: gate.viewer.role,
      actorEmail: gate.viewer.email
    }
  });

  revalidateOrders();
  return { ok: true };
}

/** Ship (hoặc đơn confirmed bất kỳ): xác nhận đã giao → fulfilled. */
export async function confirmDelivered(orderId: string): Promise<OrderActionResult> {
  const gate = await requireOps();
  if ("error" in gate) return { ok: false, error: gate.error };
  if (!orderId) return { ok: false, error: "Thiếu mã đơn." };

  const before = await loadOrder(orderId);
  if (!before) return { ok: false, error: "Không tìm thấy đơn." };
  if (before.status !== "confirmed") {
    return { ok: false, error: "Chỉ xác nhận giao cho đơn đang ở trạng thái confirmed." };
  }

  const supabase = createAdminClient();
  const now = new Date().toISOString();
  const patch: Record<string, string> = {
    status: "fulfilled",
    fulfilled_at: now,
    updated_at: now
  };
  // Pickup chưa có picked_up_at thì ghi luôn khi "đã giao/đã lấy" + người xác nhận.
  if (before.fulfillment_method === "pickup" && !before.picked_up_at) {
    patch.picked_up_at = now;
    patch.pickup_ready_at = now;
    patch.picked_up_by = gate.viewer.id;
    patch.picked_up_by_name = actorDisplayName(gate.viewer);
  }

  // Đơn ship: nên có tracking trước khi đánh dấu đã giao (có thể bỏ qua nếu đã có).
  if (before.fulfillment_method === "ship" && !before.tracking_number) {
    return {
      ok: false,
      error: "Nhập mã vận đơn (tracking) trước khi xác nhận đã giao — hoặc bấm Lưu tracking."
    };
  }

  const { data, error } = await supabase
    .from("sales_orders")
    .update(patch)
    .eq("id", orderId)
    .eq("status", "confirmed")
    .select(ORDER_SELECT);

  if (error) {
    if (error.message.includes("shipping_address") || error.message.includes("ship_address")) {
      return {
        ok: false,
        error: "Đơn ship cần địa chỉ giao hàng trước khi hoàn tất. Cập nhật địa chỉ rồi thử lại."
      };
    }
    return { ok: false, error: "Không cập nhật được đơn. Thử lại." };
  }
  if (!data || data.length === 0) {
    return { ok: false, error: "Đơn không còn ở trạng thái confirmed." };
  }

  const after = data[0] as OrderSnapshot;
  await writeAuditLog({
    actorUserId: gate.viewer.id,
    action: "order.confirm_delivered",
    entityType: "sales_order",
    entityId: orderId,
    before,
    after,
    metadata: {
      orderNumber: after.order_number,
      fulfillmentMethod: after.fulfillment_method,
      trackingNumber: after.tracking_number,
      actorRole: gate.viewer.role,
      actorEmail: gate.viewer.email
    }
  });

  revalidateOrders();
  return { ok: true };
}

/** Huỷ đơn (confirmed). Không huỷ đơn đã fulfilled. */
export async function cancelOrder(orderId: string, reason = ""): Promise<OrderActionResult> {
  const gate = await requireOps();
  if ("error" in gate) return { ok: false, error: gate.error };
  if (!orderId) return { ok: false, error: "Thiếu mã đơn." };

  const before = await loadOrder(orderId);
  if (!before) return { ok: false, error: "Không tìm thấy đơn." };
  if (before.status === "fulfilled") {
    return { ok: false, error: "Không huỷ đơn đã giao/hoàn tất." };
  }
  if (before.status === "cancelled") {
    return { ok: false, error: "Đơn đã bị huỷ trước đó." };
  }
  if (before.status !== "confirmed") {
    return { ok: false, error: "Chỉ huỷ được đơn đang confirmed." };
  }

  const note = reason.trim().slice(0, 500);
  const supabase = createAdminClient();
  const now = new Date().toISOString();
  const mergedNotes = [before.notes, note ? `Cancelled: ${note}` : "Cancelled"].filter(Boolean).join("\n");

  const { data, error } = await supabase
    .from("sales_orders")
    .update({
      status: "cancelled",
      notes: mergedNotes,
      updated_at: now
    })
    .eq("id", orderId)
    .eq("status", "confirmed")
    .select(ORDER_SELECT);

  if (error) return { ok: false, error: "Không huỷ được đơn. Thử lại." };
  if (!data || data.length === 0) {
    return { ok: false, error: "Đơn không còn huỷ được (trạng thái đã đổi)." };
  }

  const after = data[0] as OrderSnapshot;
  await writeAuditLog({
    actorUserId: gate.viewer.id,
    action: "order.cancel",
    entityType: "sales_order",
    entityId: orderId,
    before,
    after,
    metadata: {
      orderNumber: after.order_number,
      reason: note || null,
      actorRole: gate.viewer.role,
      actorEmail: gate.viewer.email
    }
  });

  revalidateOrders();
  return { ok: true };
}

/** Sửa ghi chú đơn (seller/staff). */
export async function updateOrderNotes(orderId: string, notes: string): Promise<OrderActionResult> {
  const gate = await requireOps();
  if ("error" in gate) return { ok: false, error: gate.error };
  if (!orderId) return { ok: false, error: "Thiếu mã đơn." };

  const before = await loadOrder(orderId);
  if (!before) return { ok: false, error: "Không tìm thấy đơn." };
  if (before.status === "cancelled") {
    return { ok: false, error: "Không sửa ghi chú đơn đã huỷ." };
  }

  const nextNotes = notes.trim().slice(0, 2000) || null;
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("sales_orders")
    .update({ notes: nextNotes, updated_at: new Date().toISOString() })
    .eq("id", orderId)
    .select(ORDER_SELECT);

  if (error) return { ok: false, error: "Không lưu ghi chú. Thử lại." };
  if (!data || data.length === 0) return { ok: false, error: "Không tìm thấy đơn." };

  const after = data[0] as OrderSnapshot;
  await writeAuditLog({
    actorUserId: gate.viewer.id,
    action: "order.update_notes",
    entityType: "sales_order",
    entityId: orderId,
    before: { notes: before.notes },
    after: { notes: after.notes },
    metadata: {
      orderNumber: after.order_number,
      actorRole: gate.viewer.role,
      actorEmail: gate.viewer.email
    }
  });

  revalidateOrders();
  return { ok: true };
}
