"use server";

import { revalidatePath } from "next/cache";
import { getViewer, type Viewer } from "@/lib/auth";
import { writeAuditLog } from "@/lib/data/audit-log";
import { callerKey, checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";

// Seller/staff: xác nhận giao/pickup, huỷ đơn, sửa ghi chú. Mọi thao tác ghi audit_log.

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
};

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
  const { data } = await supabase
    .from("sales_orders")
    .select("id, order_number, status, fulfillment_method, notes, picked_up_at, fulfilled_at, total_amount")
    .eq("id", id)
    .maybeSingle();
  return (data as OrderSnapshot | null) ?? null;
}

/** Pickup: khách đã lấy hàng → fulfilled. */
export async function confirmPickup(orderId: string): Promise<OrderActionResult> {
  const gate = await requireOps();
  if ("error" in gate) return { ok: false, error: gate.error };
  if (!orderId) return { ok: false, error: "Thiếu mã đơn." };

  const before = await loadOrder(orderId);
  if (!before) return { ok: false, error: "Không tìm thấy đơn." };

  const supabase = createAdminClient();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("sales_orders")
    .update({
      picked_up_at: now,
      pickup_ready_at: now,
      status: "fulfilled",
      fulfilled_at: now,
      updated_at: now
    })
    .eq("id", orderId)
    .eq("fulfillment_method", "pickup")
    .eq("status", "confirmed")
    .is("picked_up_at", null)
    .select("id, order_number, status, fulfillment_method, notes, picked_up_at, fulfilled_at, total_amount");

  if (error) return { ok: false, error: "Không cập nhật được đơn. Thử lại." };
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
  // Pickup chưa có picked_up_at thì ghi luôn khi "đã giao/đã lấy".
  if (before.fulfillment_method === "pickup" && !before.picked_up_at) {
    patch.picked_up_at = now;
    patch.pickup_ready_at = now;
  }

  const { data, error } = await supabase
    .from("sales_orders")
    .update(patch)
    .eq("id", orderId)
    .eq("status", "confirmed")
    .select("id, order_number, status, fulfillment_method, notes, picked_up_at, fulfilled_at, total_amount");

  if (error) return { ok: false, error: "Không cập nhật được đơn. Thử lại." };
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
    .select("id, order_number, status, fulfillment_method, notes, picked_up_at, fulfilled_at, total_amount");

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
    .select("id, order_number, status, fulfillment_method, notes, picked_up_at, fulfilled_at, total_amount");

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
