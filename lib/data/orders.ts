import "server-only";

import { getStaffEventsForOrders } from "@/lib/data/order-staff-events";
import type { OrderStaffEvent } from "@/lib/data/order-staff-types";
import { buildTrackingUrl, type ShippingCarrier } from "@/lib/shipping-tracking";
import { createAdminClient } from "@/lib/supabase/admin";

// Đơn hàng cho khu admin/seller. Đọc bằng service role.

export type SalesOrderStatus = "draft" | "confirmed" | "fulfilled" | "cancelled";
export type FulfillmentMethod = "pickup" | "ship";
export type { OrderStaffEvent };

export type StaffOrderItem = {
  id: string;
  productName: string;
  variantName: string | null;
  sku: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  /** Yêu cầu đặc biệt của khách cho món này. */
  lineNote: string | null;
};

export type StaffOrder = {
  id: string;
  number: string;
  /** Tên đầy đủ khách (không dùng email/username). */
  customer: string;
  /** Tên công ty nếu wholesale — hiển thị phụ. */
  customerCompany: string | null;
  customerPhone: string | null;
  status: SalesOrderStatus;
  channel: string;
  fulfillmentMethod: FulfillmentMethod;
  total: number;
  currency: string;
  createdAt: string;
  notes: string | null;
  pickedUpAt: string | null;
  fulfilledAt: string | null;
  pickupLocation: string | null;
  /** Tên người xác nhận pickup (snapshot). */
  pickedUpByName: string | null;
  pickedUpById: string | null;
  shippingCarrier: ShippingCarrier | string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  shippedAt: string | null;
  /** Người huỷ đơn (snapshot). */
  cancelledByName: string | null;
  cancelNote: string | null;
  cancelledAt: string | null;
  /** Thao tác staff gần nhất. */
  lastStaffActorName: string | null;
  lastStaffNote: string | null;
  lastStaffAction: string | null;
  lastStaffAt: string | null;
  /** Lịch sử huỷ / sửa (mới nhất trước). */
  staffEvents: OrderStaffEvent[];
  itemCount: number;
  items: StaffOrderItem[];
  /** Đơn pickup đã xác nhận nhưng CHƯA lấy hàng → cần chú ý (nhấp nháy đỏ). */
  awaitingPickup: boolean;
  /** Đơn ship confirmed — chờ xác nhận đã giao. */
  awaitingDelivery: boolean;
  canCancel: boolean;
  canEditNotes: boolean;
  /** Ship: có thể nhập/sửa tracking. */
  canEditTracking: boolean;
  /** Pickup đã xác nhận → có thể huỷ pickup (trả về chờ lấy). */
  canCancelPickup: boolean;
};

type DbCustomer = {
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  phone: string | null;
  auth_user_id: string | null;
};

type DbItem = {
  id: string;
  product_name_snapshot: string;
  variant_name_snapshot: string | null;
  sku_snapshot: string;
  quantity: number | string;
  unit_price: number | string;
  line_total?: number | string;
  line_note: string | null;
};

type DbOrder = {
  id: string;
  order_number: string | null;
  status: SalesOrderStatus;
  channel: string;
  fulfillment_method: FulfillmentMethod;
  total_amount: number | string;
  currency: string;
  created_at: string;
  notes: string | null;
  picked_up_at: string | null;
  fulfilled_at: string | null;
  shipping_carrier: string | null;
  tracking_number: string | null;
  tracking_url: string | null;
  shipped_at: string | null;
  picked_up_by: string | null;
  picked_up_by_name: string | null;
  cancelled_by_name: string | null;
  cancel_note: string | null;
  cancelled_at: string | null;
  last_staff_actor_name: string | null;
  last_staff_note: string | null;
  last_staff_action: string | null;
  last_staff_at: string | null;
  customer: DbCustomer | DbCustomer[] | null;
  location: { name: string | null } | { name: string | null }[] | null;
  items: DbItem[] | null;
};

function one<T>(value: T | T[] | null): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

/** Tên đầy đủ — không fallback email/username. */
function customerFullName(customer: DbCustomer | null): string {
  if (!customer) return "Khách lẻ";
  const full = [customer.first_name, customer.last_name].filter(Boolean).join(" ").trim();
  if (full) return full;
  // Wholesale đôi khi chỉ có company — dùng tạm khi chưa có họ tên.
  const company = customer.company_name?.trim();
  if (company) return company;
  return "Khách lẻ";
}

function num(value: number | string | null | undefined): number {
  const parsed = typeof value === "string" ? Number.parseFloat(value) : value;
  return typeof parsed === "number" && Number.isFinite(parsed) ? parsed : 0;
}

function mapItems(items: DbItem[] | null): StaffOrderItem[] {
  return (items ?? []).map((item) => {
    const quantity = num(item.quantity);
    const unitPrice = num(item.unit_price);
    const lineTotal = item.line_total != null ? num(item.line_total) : quantity * unitPrice;
    return {
      id: item.id,
      productName: item.product_name_snapshot,
      variantName: item.variant_name_snapshot,
      sku: item.sku_snapshot,
      quantity,
      unitPrice,
      lineTotal,
      lineNote: item.line_note?.trim() || null
    };
  });
}

function mapOrder(row: DbOrder, staffEvents: OrderStaffEvent[] = []): StaffOrder {
  const customer = one(row.customer);
  const location = one(row.location);
  const items = mapItems(row.items);
  const awaitingPickup =
    row.fulfillment_method === "pickup" && row.status === "confirmed" && row.picked_up_at == null;
  const awaitingDelivery = row.fulfillment_method === "ship" && row.status === "confirmed";
  const fullName = customerFullName(customer);
  const company = customer?.company_name?.trim() || null;
  return {
    id: row.id,
    number: row.order_number ?? row.id.slice(0, 8),
    customer: fullName,
    customerCompany: company && company !== fullName ? company : null,
    customerPhone: customer?.phone?.trim() || null,
    status: row.status,
    channel: row.channel,
    fulfillmentMethod: row.fulfillment_method,
    total: num(row.total_amount),
    currency: row.currency,
    createdAt: row.created_at,
    notes: row.notes,
    pickedUpAt: row.picked_up_at,
    fulfilledAt: row.fulfilled_at,
    pickupLocation: location?.name ?? null,
    pickedUpByName: row.picked_up_by_name?.trim() || null,
    pickedUpById: row.picked_up_by,
    shippingCarrier: row.shipping_carrier,
    trackingNumber: row.tracking_number?.trim() || null,
    trackingUrl: buildTrackingUrl(
      row.shipping_carrier,
      row.tracking_number,
      row.tracking_url
    ),
    shippedAt: row.shipped_at,
    cancelledByName: row.cancelled_by_name?.trim() || null,
    cancelNote: row.cancel_note?.trim() || null,
    cancelledAt: row.cancelled_at,
    lastStaffActorName: row.last_staff_actor_name?.trim() || null,
    lastStaffNote: row.last_staff_note?.trim() || null,
    lastStaffAction: row.last_staff_action?.trim() || null,
    lastStaffAt: row.last_staff_at,
    staffEvents,
    itemCount: items.length,
    items,
    awaitingPickup,
    awaitingDelivery,
    canCancel: row.status === "confirmed",
    canEditNotes: row.status !== "cancelled",
    canEditTracking: row.fulfillment_method === "ship" && row.status !== "cancelled",
    canCancelPickup:
      row.fulfillment_method === "pickup" &&
      row.status === "fulfilled" &&
      row.picked_up_at != null
  };
}

/**
 * Số đơn chưa xử lý (status confirmed — chờ pickup / ship / giao).
 * Dùng badge đỏ cạnh Orders trên admin nav.
 */
export async function getOpenOrdersCountForStaff(): Promise<number> {
  const supabase = createAdminClient();
  const { count, error } = await supabase
    .from("sales_orders")
    .select("id", { count: "exact", head: true })
    .eq("status", "confirmed");

  if (error) return 0;
  return count ?? 0;
}

export async function getOrdersForStaff(): Promise<StaffOrder[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("sales_orders")
    .select(
      `id, order_number, status, channel, fulfillment_method, total_amount, currency, created_at, notes, picked_up_at, fulfilled_at,
       shipping_carrier, tracking_number, tracking_url, shipped_at, picked_up_by, picked_up_by_name,
       cancelled_by_name, cancel_note, cancelled_at,
       last_staff_actor_name, last_staff_note, last_staff_action, last_staff_at,
       customer:customers ( first_name, last_name, company_name, phone, auth_user_id ),
       location:inventory_locations ( name ),
       items:sales_order_items ( id, product_name_snapshot, variant_name_snapshot, sku_snapshot, quantity, unit_price, line_total, line_note )`
    )
    .neq("status", "draft")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) throw new Error(`Failed to load orders: ${error.message}`);

  const rows = (data ?? []) as unknown as DbOrder[];
  const eventsByOrder = await getStaffEventsForOrders(rows.map((r) => r.id));

  // Bổ sung họ tên / SĐT từ profiles khi hồ sơ customers còn trống.
  const authIds = [
    ...new Set(
      rows
        .map((row) => one(row.customer)?.auth_user_id)
        .filter((id): id is string => Boolean(id))
    )
  ];
  const profileById = new Map<string, { full_name: string | null; phone: string | null }>();
  if (authIds.length) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, phone")
      .in("id", authIds);
    for (const p of profiles ?? []) {
      profileById.set(p.id, { full_name: p.full_name, phone: p.phone });
    }
  }

  // Đơn huỷ cũ thiếu cancelled_by_name → bù từ audit_log (order.cancel).
  const cancelMissingIds = rows
    .filter((r) => r.status === "cancelled" && !r.cancelled_by_name?.trim())
    .map((r) => r.id);
  const cancelFromAudit = await loadCancelActorsFromAudit(cancelMissingIds);

  return rows.map((row) => {
    const customer = one(row.customer);
    if (customer?.auth_user_id) {
      const profile = profileById.get(customer.auth_user_id);
      if (profile) {
        if (!customer.first_name && !customer.last_name && profile.full_name) {
          const parts = profile.full_name.trim().split(/\s+/);
          customer.first_name = parts[0] ?? null;
          customer.last_name = parts.length > 1 ? parts.slice(1).join(" ") : null;
        }
        if (!customer.phone && profile.phone) customer.phone = profile.phone;
      }
    }
    const audit = cancelFromAudit.get(row.id);
    if (audit && !row.cancelled_by_name) {
      row.cancelled_by_name = audit.name;
      row.cancel_note = row.cancel_note || audit.note;
      row.cancelled_at = row.cancelled_at || audit.at;
    }
    // Bù từ staff event cancel nếu vẫn trống.
    const events = eventsByOrder.get(row.id) ?? [];
    if (row.status === "cancelled" && !row.cancelled_by_name) {
      const cancelEv = events.find((e) => e.action === "cancel");
      if (cancelEv) {
        row.cancelled_by_name = cancelEv.actorName;
        row.cancel_note = row.cancel_note || cancelEv.note;
        row.cancelled_at = row.cancelled_at || cancelEv.createdAt;
      }
    }
    return mapOrder(row, events);
  });
}

/** Đọc ai huỷ đơn từ audit_log (đơn huỷ trước khi có cột cancelled_by_name). */
async function loadCancelActorsFromAudit(
  orderIds: string[]
): Promise<Map<string, { name: string; note: string | null; at: string }>> {
  const map = new Map<string, { name: string; note: string | null; at: string }>();
  if (!orderIds.length) return map;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("audit_log")
    .select("entity_id, metadata, created_at, actor_user_id, profiles!audit_log_actor_user_id_fkey ( full_name, email )")
    .eq("action", "order.cancel")
    .eq("entity_type", "sales_order")
    .in("entity_id", orderIds)
    .order("created_at", { ascending: false });

  if (error || !data) return map;

  for (const row of data as {
    entity_id: string | null;
    metadata: Record<string, unknown> | null;
    created_at: string;
    actor_user_id: string | null;
    profiles:
      | { full_name: string | null; email: string | null }
      | { full_name: string | null; email: string | null }[]
      | null;
  }[]) {
    if (!row.entity_id || map.has(row.entity_id)) continue;
    const meta = row.metadata ?? {};
    const metaName =
      (typeof meta.cancelledByName === "string" && meta.cancelledByName.trim()) ||
      (typeof meta.actorName === "string" && meta.actorName.trim()) ||
      null;
    const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    const name =
      metaName ||
      profile?.full_name?.trim() ||
      profile?.email?.trim() ||
      (row.actor_user_id ? row.actor_user_id.slice(0, 8) : null);
    if (!name) continue;
    const note =
      (typeof meta.reason === "string" && meta.reason.trim()) ||
      (typeof meta.staffNote === "string" && meta.staffNote.trim()) ||
      null;
    map.set(row.entity_id, { name, note, at: row.created_at });
  }
  return map;
}
