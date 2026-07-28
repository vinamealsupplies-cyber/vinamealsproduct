import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

// Đơn hàng cho khu admin/seller. Đọc bằng service role.

export type SalesOrderStatus = "draft" | "confirmed" | "fulfilled" | "cancelled";
export type FulfillmentMethod = "pickup" | "ship";

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
  itemCount: number;
  items: StaffOrderItem[];
  /** Đơn pickup đã xác nhận nhưng CHƯA lấy hàng → cần chú ý (nhấp nháy đỏ). */
  awaitingPickup: boolean;
  /** Đơn ship confirmed — chờ xác nhận đã giao. */
  awaitingDelivery: boolean;
  canCancel: boolean;
  canEditNotes: boolean;
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

function mapOrder(row: DbOrder): StaffOrder {
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
    itemCount: items.length,
    items,
    awaitingPickup,
    awaitingDelivery,
    canCancel: row.status === "confirmed",
    canEditNotes: row.status !== "cancelled"
  };
}

export async function getOrdersForStaff(): Promise<StaffOrder[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("sales_orders")
    .select(
      `id, order_number, status, channel, fulfillment_method, total_amount, currency, created_at, notes, picked_up_at, fulfilled_at,
       customer:customers ( first_name, last_name, company_name, phone, auth_user_id ),
       location:inventory_locations ( name ),
       items:sales_order_items ( id, product_name_snapshot, variant_name_snapshot, sku_snapshot, quantity, unit_price, line_total, line_note )`
    )
    .neq("status", "draft")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) throw new Error(`Failed to load orders: ${error.message}`);

  const rows = (data ?? []) as unknown as DbOrder[];

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
    return mapOrder(row);
  });
}
