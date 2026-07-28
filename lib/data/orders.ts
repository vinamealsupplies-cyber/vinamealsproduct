import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

// Đơn hàng cho khu admin/seller. Đọc bằng service role (như customers.ts) —
// trang gọi đã qua gate ở app/admin/layout.tsx (canAccessAdmin).

export type SalesOrderStatus = "draft" | "confirmed" | "fulfilled" | "cancelled";
export type FulfillmentMethod = "pickup" | "ship";

export type StaffOrder = {
  id: string;
  number: string;
  customer: string;
  status: SalesOrderStatus;
  channel: string;
  fulfillmentMethod: FulfillmentMethod;
  total: number;
  currency: string;
  createdAt: string;
  pickedUpAt: string | null;
  pickupLocation: string | null;
  itemCount: number;
  /** Đơn pickup đã xác nhận nhưng CHƯA lấy hàng → cần chú ý (nhấp nháy đỏ). */
  awaitingPickup: boolean;
};

type DbCustomer = {
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  email: string | null;
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
  picked_up_at: string | null;
  customer: DbCustomer | DbCustomer[] | null;
  location: { name: string | null } | { name: string | null }[] | null;
  items: { id: string }[] | null;
};

function one<T>(value: T | T[] | null): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function customerName(customer: DbCustomer | null): string {
  if (!customer) return "Khách lẻ";
  const company = customer.company_name?.trim();
  if (company) return company;
  const full = [customer.first_name, customer.last_name].filter(Boolean).join(" ").trim();
  if (full) return full;
  return customer.email?.trim() || "Khách lẻ";
}

function num(value: number | string | null | undefined): number {
  const parsed = typeof value === "string" ? Number.parseFloat(value) : value;
  return typeof parsed === "number" && Number.isFinite(parsed) ? parsed : 0;
}

function mapOrder(row: DbOrder): StaffOrder {
  const customer = one(row.customer);
  const location = one(row.location);
  return {
    id: row.id,
    number: row.order_number ?? row.id.slice(0, 8),
    customer: customerName(customer),
    status: row.status,
    channel: row.channel,
    fulfillmentMethod: row.fulfillment_method,
    total: num(row.total_amount),
    currency: row.currency,
    createdAt: row.created_at,
    pickedUpAt: row.picked_up_at,
    pickupLocation: location?.name ?? null,
    itemCount: row.items?.length ?? 0,
    awaitingPickup:
      row.fulfillment_method === "pickup" && row.status === "confirmed" && row.picked_up_at == null
  };
}

export async function getOrdersForStaff(): Promise<StaffOrder[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("sales_orders")
    .select(
      "id, order_number, status, channel, fulfillment_method, total_amount, currency, created_at, picked_up_at, customer:customers ( first_name, last_name, company_name, email ), location:inventory_locations ( name ), items:sales_order_items ( id )"
    )
    .neq("status", "draft")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) throw new Error(`Failed to load orders: ${error.message}`);
  return ((data ?? []) as unknown as DbOrder[]).map(mapOrder);
}
