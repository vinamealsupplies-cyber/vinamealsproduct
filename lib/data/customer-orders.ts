import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export type CustomerOrderStatus = "draft" | "confirmed" | "fulfilled" | "cancelled";
export type CustomerFulfillment = "pickup" | "ship";

export type CustomerOrderItem = {
  id: string;
  productName: string;
  variantName: string | null;
  sku: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

export type CustomerOrder = {
  id: string;
  number: string;
  status: CustomerOrderStatus;
  fulfillmentMethod: CustomerFulfillment;
  total: number;
  currency: string;
  placedAt: string;
  createdAt: string;
  notes: string | null;
  pickedUpAt: string | null;
  fulfilledAt: string | null;
  itemCount: number;
  items: CustomerOrderItem[];
  /** Đơn còn mở — khách đang mua / chờ nhận. */
  isOpen: boolean;
  statusLabel: string;
  statusDetail: string;
};

type DbItem = {
  id: string;
  product_name_snapshot: string;
  variant_name_snapshot: string | null;
  sku_snapshot: string;
  quantity: number | string;
  unit_price: number | string;
  line_total?: number | string;
};

type DbOrder = {
  id: string;
  order_number: string | null;
  status: CustomerOrderStatus;
  fulfillment_method: CustomerFulfillment;
  total_amount: number | string;
  currency: string;
  placed_at: string | null;
  created_at: string;
  notes: string | null;
  picked_up_at: string | null;
  fulfilled_at: string | null;
  items: DbItem[] | null;
};

function num(value: number | string | null | undefined): number {
  const parsed = typeof value === "string" ? Number.parseFloat(value) : value;
  return typeof parsed === "number" && Number.isFinite(parsed) ? parsed : 0;
}

function statusCopy(order: {
  status: CustomerOrderStatus;
  fulfillmentMethod: CustomerFulfillment;
  pickedUpAt: string | null;
}): { label: string; detail: string; isOpen: boolean } {
  if (order.status === "cancelled") {
    return { label: "Cancelled", detail: "This order was cancelled.", isOpen: false };
  }
  if (order.status === "fulfilled") {
    return {
      label: "Completed",
      detail:
        order.fulfillmentMethod === "pickup"
          ? "Picked up / completed."
          : "Delivered / completed.",
      isOpen: false
    };
  }
  if (order.status === "confirmed") {
    if (order.fulfillmentMethod === "pickup") {
      return {
        label: "Ready for pickup",
        detail: order.pickedUpAt
          ? "Pickup recorded."
          : "We are preparing your order. Come pick it up when ready.",
        isOpen: true
      };
    }
    return {
      label: "In progress",
      detail: "Your order is being prepared or shipped.",
      isOpen: true
    };
  }
  return { label: "Draft", detail: "Not submitted yet.", isOpen: false };
}

function mapOrder(row: DbOrder): CustomerOrder {
  const items = (row.items ?? []).map((item) => {
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
      lineTotal
    };
  });

  const fulfillmentMethod = row.fulfillment_method ?? "pickup";
  const copy = statusCopy({
    status: row.status,
    fulfillmentMethod,
    pickedUpAt: row.picked_up_at
  });

  return {
    id: row.id,
    number: row.order_number ?? row.id.slice(0, 8),
    status: row.status,
    fulfillmentMethod,
    total: num(row.total_amount),
    currency: row.currency,
    placedAt: row.placed_at ?? row.created_at,
    createdAt: row.created_at,
    notes: row.notes,
    pickedUpAt: row.picked_up_at,
    fulfilledAt: row.fulfilled_at,
    itemCount: items.length,
    items,
    isOpen: copy.isOpen,
    statusLabel: copy.label,
    statusDetail: copy.detail
  };
}

/**
 * Đơn hàng của tài khoản đang đăng nhập (qua customers.auth_user_id).
 * Service role + filter theo user — khách chỉ thấy đơn của mình.
 */
export async function getOwnOrders(authUserId: string): Promise<CustomerOrder[]> {
  const supabase = createAdminClient();

  const { data: customer } = await supabase
    .from("customers")
    .select("id")
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  if (!customer?.id) return [];

  const { data, error } = await supabase
    .from("sales_orders")
    .select(
      "id, order_number, status, fulfillment_method, total_amount, currency, placed_at, created_at, notes, picked_up_at, fulfilled_at, items:sales_order_items ( id, product_name_snapshot, variant_name_snapshot, sku_snapshot, quantity, unit_price, line_total )"
    )
    .eq("customer_id", customer.id)
    .neq("status", "draft")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) throw new Error(`Failed to load orders: ${error.message}`);
  return ((data ?? []) as unknown as DbOrder[]).map(mapOrder);
}
