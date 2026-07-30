"use server";

import { revalidatePath } from "next/cache";
import { getViewer, type Viewer } from "@/lib/auth";
import {
  actorAuditMeta,
  actorDisplayName,
  writeAuditLog
} from "@/lib/data/audit-log";
import {
  recordOrderStaffEvent,
  requireStaffNote
} from "@/lib/data/order-staff-events";
import { callerKey, checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import {
  buildTrackingUrl,
  isShippingCarrier,
  type ShippingCarrier
} from "@/lib/shipping-tracking";
import { createAdminClient } from "@/lib/supabase/admin";

// Seller/staff: xác nhận giao/pickup, tracking ship, huỷ đơn, ghi chú.
// Huỷ / sửa: BẮT BUỘC note + ghi tên người thao tác (sales_order_staff_events).

export type OrderActionResult = { ok: true } | { ok: false; error: string };

type OrderSnapshot = {
  id: string;
  order_number: string | null;
  status: string;
  fulfillment_method: string | null;
  notes: string | null;
  pickup_ready_at?: string | null;
  picked_up_at: string | null;
  fulfilled_at: string | null;
  total_amount: number | string | null;
  shipping_carrier?: string | null;
  tracking_number?: string | null;
  tracking_url?: string | null;
  shipped_at?: string | null;
  picked_up_by?: string | null;
  picked_up_by_name?: string | null;
  cancelled_by_name?: string | null;
  cancel_note?: string | null;
};

const ORDER_SELECT =
  "id, order_number, status, fulfillment_method, notes, pickup_ready_at, picked_up_at, fulfilled_at, total_amount, shipping_carrier, tracking_number, tracking_url, shipped_at, picked_up_by, picked_up_by_name, cancelled_by_name, cancel_note";

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
  revalidatePath("/account");
}

async function loadOrder(id: string): Promise<OrderSnapshot | null> {
  const supabase = createAdminClient();
  const { data } = await supabase.from("sales_orders").select(ORDER_SELECT).eq("id", id).maybeSingle();
  return (data as OrderSnapshot | null) ?? null;
}

async function stampStaff(
  orderId: string,
  viewer: Viewer,
  action: string,
  note: string
): Promise<OrderActionResult | null> {
  const result = await recordOrderStaffEvent({
    orderId,
    actorUserId: viewer.id,
    actorName: actorDisplayName(viewer),
    action,
    note
  });
  if (!result.ok) return { ok: false, error: result.error };
  return null;
}

/**
 * Lưu shipping info (carrier + tracking).
 * markShipped=true → xác nhận đã ship (fulfilled). Bắt buộc note + tên người sửa.
 */
export async function saveShipmentTracking(
  orderId: string,
  carrier: string,
  trackingNumber: string,
  customUrl = "",
  markShipped = false,
  staffNote = ""
): Promise<OrderActionResult> {
  const gate = await requireOps();
  if ("error" in gate) return { ok: false, error: gate.error };
  if (!orderId) return { ok: false, error: "Thiếu mã đơn." };

  const noteGate = requireStaffNote(staffNote);
  if (!noteGate.ok) return noteGate;

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
    return { ok: false, error: "Chỉ đơn ship mới có mã vận đơn / xác nhận đã ship." };
  }
  if (markShipped && before.status !== "confirmed") {
    return { ok: false, error: "Chỉ xác nhận đã ship cho đơn đang confirmed." };
  }

  const trackingUrl =
    override || buildTrackingUrl(carrierCode as ShippingCarrier, tracking) || null;
  const now = new Date().toISOString();
  const supabase = createAdminClient();
  const actorName = actorDisplayName(gate.viewer);

  const patch: Record<string, unknown> = {
    shipping_carrier: carrierCode,
    tracking_number: tracking,
    tracking_url: trackingUrl,
    shipped_at: before.shipped_at ?? now,
    updated_at: now
  };
  if (markShipped) {
    patch.status = "fulfilled";
    patch.fulfilled_at = now;
  }

  const { data, error } = await supabase
    .from("sales_orders")
    .update(patch)
    .eq("id", orderId)
    .select(ORDER_SELECT);

  if (error) {
    if (error.message.includes("shipping_carrier") || error.message.includes("tracking_number")) {
      return {
        ok: false,
        error: "Database chưa có cột tracking. Chạy migration 20260728220000_order_shipping_tracking.sql."
      };
    }
    if (error.message.includes("shipping_address") || error.message.includes("ship_address")) {
      return {
        ok: false,
        error: "Đơn ship cần địa chỉ giao hàng trước khi xác nhận đã ship."
      };
    }
    return { ok: false, error: "Không lưu shipping info. Thử lại." };
  }
  if (!data?.length) return { ok: false, error: "Không tìm thấy đơn." };

  const action = markShipped ? "confirm_shipped" : "save_tracking";
  const stampErr = await stampStaff(orderId, gate.viewer, action, noteGate.note);
  if (stampErr) return stampErr;

  const after = data[0] as OrderSnapshot;
  await writeAuditLog({
    actorUserId: gate.viewer.id,
    action: markShipped ? "order.confirm_shipped" : "order.save_tracking",
    entityType: "sales_order",
    entityId: orderId,
    before: {
      status: before.status,
      shipping_carrier: before.shipping_carrier,
      tracking_number: before.tracking_number,
      shipped_at: before.shipped_at
    },
    after: {
      status: after.status,
      shipping_carrier: after.shipping_carrier,
      tracking_number: after.tracking_number,
      tracking_url: after.tracking_url,
      shipped_at: after.shipped_at,
      fulfilled_at: after.fulfilled_at
    },
    metadata: {
      ...actorAuditMeta(gate.viewer),
      orderNumber: after.order_number,
      markShipped,
      staffNote: noteGate.note,
      actorName
    }
  });

  revalidateOrders();
  return { ok: true };
}

/**
 * Pickup: staff marks order READY for the customer to come collect.
 * Status stays confirmed; customer sees “Ready for pickup”.
 */
export async function markPickupReady(
  orderId: string,
  staffNote = ""
): Promise<OrderActionResult> {
  const gate = await requireOps();
  if ("error" in gate) return { ok: false, error: gate.error };
  if (!orderId) return { ok: false, error: "Thiếu mã đơn." };

  const before = await loadOrder(orderId);
  if (!before) return { ok: false, error: "Không tìm thấy đơn." };
  if (before.fulfillment_method !== "pickup") {
    return { ok: false, error: "Chỉ áp dụng cho đơn nhận tại cửa hàng." };
  }
  if (before.status !== "confirmed") {
    return { ok: false, error: "Đơn không còn chờ xử lý." };
  }
  if (before.picked_up_at) {
    return { ok: false, error: "Khách đã lấy hàng rồi." };
  }
  if (before.pickup_ready_at) {
    return { ok: false, error: "Đơn đã được đánh dấu sẵn sàng pickup." };
  }

  const actorName = actorDisplayName(gate.viewer);
  const note =
    staffNote.trim().slice(0, 500) || `Đơn sẵn sàng để khách đến lấy — ${actorName}`;
  const supabase = createAdminClient();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("sales_orders")
    .update({
      pickup_ready_at: now,
      updated_at: now
    })
    .eq("id", orderId)
    .eq("fulfillment_method", "pickup")
    .eq("status", "confirmed")
    .is("picked_up_at", null)
    .is("pickup_ready_at", null)
    .select(ORDER_SELECT);

  if (error) {
    if (error.message.includes("pickup_ready_at")) {
      return {
        ok: false,
        error: "Database thiếu cột pickup_ready_at. Chạy migration fulfillment pickup/ship."
      };
    }
    return { ok: false, error: "Không cập nhật được đơn. Thử lại." };
  }
  if (!data?.length) {
    return { ok: false, error: "Không đánh dấu sẵn sàng (có thể đã làm trước đó)." };
  }

  await stampStaff(orderId, gate.viewer, "pickup_ready", note);
  await writeAuditLog({
    actorUserId: gate.viewer.id,
    action: "order.pickup_ready",
    entityType: "sales_order",
    entityId: orderId,
    before,
    after: data[0],
    metadata: {
      ...actorAuditMeta(gate.viewer),
      orderNumber: data[0].order_number,
      staffNote: note,
      actorName
    }
  });

  revalidateOrders();
  return { ok: true };
}

/** Pickup: khách đã lấy hàng → fulfilled. Ghi tên người xác nhận. Note tuỳ chọn. */
export async function confirmPickup(orderId: string, staffNote = ""): Promise<OrderActionResult> {
  const gate = await requireOps();
  if ("error" in gate) return { ok: false, error: gate.error };
  if (!orderId) return { ok: false, error: "Thiếu mã đơn." };

  const before = await loadOrder(orderId);
  if (!before) return { ok: false, error: "Không tìm thấy đơn." };

  const confirmerName = actorDisplayName(gate.viewer);
  const note =
    staffNote.trim().slice(0, 500) || `Xác nhận khách đã lấy hàng — ${confirmerName}`;
  const supabase = createAdminClient();
  const now = new Date().toISOString();
  // Ensure pickup_ready_at is set (constraint allows ready null OR ready <= picked_up).
  const readyAt = before.pickup_ready_at ?? now;
  const { data, error } = await supabase
    .from("sales_orders")
    .update({
      picked_up_at: now,
      pickup_ready_at: readyAt,
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

  await stampStaff(orderId, gate.viewer, "confirm_pickup", note);

  const after = data[0] as OrderSnapshot;
  await writeAuditLog({
    actorUserId: gate.viewer.id,
    action: "order.confirm_pickup",
    entityType: "sales_order",
    entityId: orderId,
    before,
    after,
    metadata: {
      ...actorAuditMeta(gate.viewer),
      orderNumber: after.order_number,
      confirmedByName: confirmerName,
      confirmedById: gate.viewer.id,
      staffNote: note
    }
  });

  revalidateOrders();
  return { ok: true };
}

/**
 * Huỷ pickup đã xác nhận → trả đơn về confirmed (chờ pickup lại).
 * Bắt buộc note + tên người huỷ.
 */
export async function cancelPickup(orderId: string, reason = ""): Promise<OrderActionResult> {
  const gate = await requireOps();
  if ("error" in gate) return { ok: false, error: gate.error };
  if (!orderId) return { ok: false, error: "Thiếu mã đơn." };

  const noteGate = requireStaffNote(reason);
  if (!noteGate.ok) return noteGate;

  const before = await loadOrder(orderId);
  if (!before) return { ok: false, error: "Không tìm thấy đơn." };
  if (before.fulfillment_method !== "pickup") {
    return { ok: false, error: "Chỉ huỷ pickup cho đơn nhận tại cửa hàng." };
  }
  if (before.status !== "fulfilled" || !before.picked_up_at) {
    return { ok: false, error: "Đơn chưa được xác nhận pickup." };
  }

  const cancellerName = actorDisplayName(gate.viewer);
  const now = new Date().toISOString();
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("sales_orders")
    .update({
      status: "confirmed",
      picked_up_at: null,
      fulfilled_at: null,
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

  const stampErr = await stampStaff(orderId, gate.viewer, "cancel_pickup", noteGate.note);
  if (stampErr) return stampErr;

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
      ...actorAuditMeta(gate.viewer),
      orderNumber: after.order_number,
      reason: noteGate.note,
      previousConfirmedByName: before.picked_up_by_name,
      previousConfirmedById: before.picked_up_by,
      cancelledByName: cancellerName,
      cancelledById: gate.viewer.id
    }
  });

  revalidateOrders();
  return { ok: true };
}

/** Ship (hoặc đơn confirmed bất kỳ): xác nhận đã giao → fulfilled. */
export async function confirmDelivered(
  orderId: string,
  staffNote = ""
): Promise<OrderActionResult> {
  const gate = await requireOps();
  if ("error" in gate) return { ok: false, error: gate.error };
  if (!orderId) return { ok: false, error: "Thiếu mã đơn." };

  const noteGate = requireStaffNote(staffNote);
  if (!noteGate.ok) return noteGate;

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
  if (before.fulfillment_method === "pickup" && !before.picked_up_at) {
    patch.picked_up_at = now;
    patch.pickup_ready_at = now;
    patch.picked_up_by = gate.viewer.id;
    patch.picked_up_by_name = actorDisplayName(gate.viewer);
  }

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

  const stampErr = await stampStaff(orderId, gate.viewer, "confirm_delivered", noteGate.note);
  if (stampErr) return stampErr;

  const after = data[0] as OrderSnapshot;
  await writeAuditLog({
    actorUserId: gate.viewer.id,
    action: "order.confirm_delivered",
    entityType: "sales_order",
    entityId: orderId,
    before,
    after,
    metadata: {
      ...actorAuditMeta(gate.viewer),
      orderNumber: after.order_number,
      fulfillmentMethod: after.fulfillment_method,
      trackingNumber: after.tracking_number,
      staffNote: noteGate.note
    }
  });

  revalidateOrders();
  return { ok: true };
}

/** Huỷ đơn (confirmed). Bắt buộc note + tên người huỷ. */
export async function cancelOrder(orderId: string, reason = ""): Promise<OrderActionResult> {
  const gate = await requireOps();
  if ("error" in gate) return { ok: false, error: gate.error };
  if (!orderId) return { ok: false, error: "Thiếu mã đơn." };

  const noteGate = requireStaffNote(reason);
  if (!noteGate.ok) return noteGate;

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

  const actorName = actorDisplayName(gate.viewer);
  const supabase = createAdminClient();
  const now = new Date().toISOString();
  // Ghi rõ tên trong notes + cột cancelled_* trong CÙNG 1 update (không phụ thuộc bước 2).
  const stampLine = `Huỷ bởi ${actorName}: ${noteGate.note}`;
  const mergedNotes = [before.notes, stampLine].filter(Boolean).join("\n");

  const { data, error } = await supabase
    .from("sales_orders")
    .update({
      status: "cancelled",
      notes: mergedNotes,
      cancelled_by: gate.viewer.id,
      cancelled_by_name: actorName,
      cancelled_at: now,
      cancel_note: noteGate.note,
      last_staff_action: "cancel",
      last_staff_actor_id: gate.viewer.id,
      last_staff_actor_name: actorName,
      last_staff_note: noteGate.note,
      last_staff_at: now,
      updated_at: now
    })
    .eq("id", orderId)
    .eq("status", "confirmed")
    .select(ORDER_SELECT);

  if (error) {
    if (error.message.includes("cancelled_by")) {
      return {
        ok: false,
        error: "Database chưa có cột huỷ đơn. Chạy migration 20260728270000_order_staff_actions.sql."
      };
    }
    return { ok: false, error: "Không huỷ được đơn. Thử lại." };
  }
  if (!data || data.length === 0) {
    return { ok: false, error: "Đơn không còn huỷ được (trạng thái đã đổi)." };
  }

  // Lịch sử events (nếu fail vẫn giữ cancelled_* đã ghi ở trên).
  await stampStaff(orderId, gate.viewer, "cancel", noteGate.note);

  const after = data[0] as OrderSnapshot;
  await writeAuditLog({
    actorUserId: gate.viewer.id,
    action: "order.cancel",
    entityType: "sales_order",
    entityId: orderId,
    before,
    after,
    metadata: {
      ...actorAuditMeta(gate.viewer),
      orderNumber: after.order_number,
      reason: noteGate.note,
      cancelledByName: actorName
    }
  });

  revalidateOrders();
  return { ok: true };
}

/** Sửa ghi chú đơn. Bắt buộc note thao tác + tên người sửa. */
export async function updateOrderNotes(
  orderId: string,
  notes: string,
  staffNote = ""
): Promise<OrderActionResult> {
  const gate = await requireOps();
  if ("error" in gate) return { ok: false, error: gate.error };
  if (!orderId) return { ok: false, error: "Thiếu mã đơn." };

  const noteGate = requireStaffNote(staffNote);
  if (!noteGate.ok) return noteGate;

  const before = await loadOrder(orderId);
  if (!before) return { ok: false, error: "Không tìm thấy đơn." };
  if (before.status === "cancelled") {
    return { ok: false, error: "Không sửa ghi chú đơn đã huỷ." };
  }

  const actorName = actorDisplayName(gate.viewer);
  const nextNotes = notes.trim().slice(0, 2000) || null;
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("sales_orders")
    .update({ notes: nextNotes, updated_at: new Date().toISOString() })
    .eq("id", orderId)
    .select(ORDER_SELECT);

  if (error) return { ok: false, error: "Không lưu ghi chú. Thử lại." };
  if (!data || data.length === 0) return { ok: false, error: "Không tìm thấy đơn." };

  const stampErr = await stampStaff(orderId, gate.viewer, "update_notes", noteGate.note);
  if (stampErr) return stampErr;

  const after = data[0] as OrderSnapshot;
  await writeAuditLog({
    actorUserId: gate.viewer.id,
    action: "order.update_notes",
    entityType: "sales_order",
    entityId: orderId,
    before: { notes: before.notes },
    after: { notes: after.notes },
    metadata: {
      ...actorAuditMeta(gate.viewer),
      orderNumber: after.order_number,
      staffNote: noteGate.note,
      actorName
    }
  });

  revalidateOrders();
  return { ok: true };
}

/**
 * Confirm offline payment (check / Zelle / bank transfer) for an order invoice.
 * Marks pending payments succeeded or inserts a new succeeded payment.
 */
export async function confirmOrderPayment(
  orderId: string,
  staffNote = "",
  reference = ""
): Promise<OrderActionResult> {
  const gate = await requireOps();
  if ("error" in gate) return { ok: false, error: gate.error };
  if (!orderId) return { ok: false, error: "Missing order id." };

  const noteGate = requireStaffNote(staffNote);
  if (!noteGate.ok) return noteGate;

  const supabase = createAdminClient();
  const before = await loadOrder(orderId);
  if (!before) return { ok: false, error: "Order not found." };
  if (before.status === "cancelled") return { ok: false, error: "Order is cancelled." };

  const { data: invoice } = await supabase
    .from("invoices")
    .select("id, invoice_number, total_amount, amount_paid, status, balance_due")
    .eq("order_id", orderId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!invoice) return { ok: false, error: "No invoice for this order." };

  const total = typeof invoice.total_amount === "string"
    ? Number.parseFloat(invoice.total_amount)
    : Number(invoice.total_amount);
  const paid = typeof invoice.amount_paid === "string"
    ? Number.parseFloat(invoice.amount_paid)
    : Number(invoice.amount_paid ?? 0);
  const due = Math.max(0, (Number.isFinite(total) ? total : 0) - (Number.isFinite(paid) ? paid : 0));

  if (due <= 0.009 || invoice.status === "paid") {
    return { ok: false, error: "Invoice is already paid." };
  }

  const { data: orderPay } = await supabase
    .from("sales_orders")
    .select("payment_method, payment_reference, order_number")
    .eq("id", orderId)
    .maybeSingle();

  const method = orderPay?.payment_method || "other";
  const ref =
    reference.trim().slice(0, 120) ||
    orderPay?.payment_reference ||
    orderPay?.order_number ||
    null;
  const now = new Date().toISOString();
  const actorName = actorDisplayName(gate.viewer);

  // Prefer upgrading existing pending payment for this invoice.
  const { data: pending } = await supabase
    .from("payments")
    .select("id, amount")
    .eq("invoice_id", invoice.id)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (pending?.id) {
    const { error } = await supabase
      .from("payments")
      .update({
        status: "succeeded",
        amount: due,
        payment_method: method,
        reference: ref,
        received_at: now,
        notes: `Confirmed by ${actorName}. ${noteGate.note}`,
        created_by: gate.viewer.id
      })
      .eq("id", pending.id);
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await supabase.from("payments").insert({
      invoice_id: invoice.id,
      payment_kind: "payment",
      status: "succeeded",
      amount: due,
      currency: "USD",
      payment_method: method,
      provider: "offline",
      reference: ref,
      received_at: now,
      notes: `Confirmed by ${actorName}. ${noteGate.note}`,
      created_by: gate.viewer.id
    });
    if (error) return { ok: false, error: error.message };
  }

  await supabase
    .from("sales_orders")
    .update({
      payment_confirmed_at: now,
      payment_confirmed_by: gate.viewer.id,
      payment_reference: ref,
      updated_at: now
    })
    .eq("id", orderId);

  const stampErr = await stampStaff(orderId, gate.viewer, "confirm_payment", noteGate.note);
  if (stampErr) return stampErr;

  await writeAuditLog({
    actorUserId: gate.viewer.id,
    action: "order.confirm_payment",
    entityType: "sales_order",
    entityId: orderId,
    after: {
      orderNumber: before.order_number,
      amount: due,
      paymentMethod: method,
      reference: ref
    },
    metadata: {
      ...actorAuditMeta(gate.viewer),
      orderNumber: before.order_number,
      staffNote: noteGate.note,
      actorName
    }
  });

  revalidateOrders();
  revalidatePath("/admin/invoices");
  revalidatePath("/admin/payments");
  revalidatePath("/admin/reports");
  return { ok: true };
}
