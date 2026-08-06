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
  lineNote: string | null;
};

export type CustomerOrderAddress = {
  recipientName: string | null;
  companyName: string | null;
  phone: string | null;
  note: string | null;
  line1: string | null;
  line2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
};

export type CustomerPickupLocation = {
  name: string;
  addressLines: string[];
  instructions: string | null;
};

export type CustomerOrder = {
  id: string;
  number: string;
  status: CustomerOrderStatus;
  fulfillmentMethod: CustomerFulfillment;
  subtotal: number;
  discount: number;
  tax: number;
  shipping: number;
  total: number;
  currency: string;
  placedAt: string;
  createdAt: string;
  notes: string | null;
  /** Staff marked ready for customer to collect at store. */
  pickupReadyAt: string | null;
  pickedUpAt: string | null;
  shippedAt: string | null;
  fulfilledAt: string | null;
  cancelledAt: string | null;
  cancelNote: string | null;
  shippingCarrier: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  shippingAddress: CustomerOrderAddress | null;
  pickupLocation: CustomerPickupLocation | null;
  /** Thời điểm thanh toán thành công (payments.received_at), null nếu chưa thanh toán. */
  paidAt: string | null;
  paymentMethod: string | null;
  paymentStatus: "paid" | "pending" | "partial" | "none";
  paymentReference: string | null;
  invoiceNumber: string | null;
  amountPaid: number;
  balanceDue: number;
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
  line_note?: string | null;
};

type DbPayment = {
  received_at: string | null;
  status: string;
  amount: number | string;
  payment_method: string | null;
  created_at: string;
};

type DbInvoice = {
  id: string;
  invoice_number: string | null;
  amount_paid: number | string | null;
  balance_due: number | string | null;
  total_amount: number | string | null;
  status: string;
  payments: DbPayment[] | DbPayment | null;
};

type DbPickupLocation = {
  name: string | null;
  address: Record<string, unknown> | null;
  pickup_instructions: string | null;
};

type DbOrder = {
  id: string;
  order_number: string | null;
  status: CustomerOrderStatus;
  fulfillment_method: CustomerFulfillment;
  subtotal: number | string;
  discount_amount: number | string;
  tax_amount: number | string;
  shipping_amount: number | string;
  total_amount: number | string;
  currency: string;
  placed_at: string | null;
  created_at: string;
  notes: string | null;
  pickup_ready_at?: string | null;
  picked_up_at: string | null;
  shipped_at: string | null;
  fulfilled_at: string | null;
  cancelled_at: string | null;
  cancel_note: string | null;
  shipping_carrier: string | null;
  tracking_number: string | null;
  tracking_url: string | null;
  shipping_address_snapshot: Record<string, unknown> | null;
  payment_method: string | null;
  payment_reference: string | null;
  payment_confirmed_at: string | null;
  pickup_location: DbPickupLocation | DbPickupLocation[] | null;
  items: DbItem[] | null;
  invoices: DbInvoice[] | DbInvoice | null;
};

function num(value: number | string | null | undefined): number {
  const parsed = typeof value === "string" ? Number.parseFloat(value) : value;
  return typeof parsed === "number" && Number.isFinite(parsed) ? parsed : 0;
}

function asArray<T>(value: T | T[] | null | undefined): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function first<T>(value: T | T[] | null | undefined): T | null {
  return asArray(value)[0] ?? null;
}

function snapshotText(snapshot: Record<string, unknown>, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = snapshot[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function mapShippingAddress(
  snapshot: Record<string, unknown> | null | undefined
): CustomerOrderAddress | null {
  if (!snapshot || typeof snapshot !== "object") return null;
  const address: CustomerOrderAddress = {
    recipientName: snapshotText(snapshot, "recipient_name", "recipientName"),
    companyName: snapshotText(snapshot, "company_name", "companyName"),
    phone: snapshotText(snapshot, "phone"),
    note: snapshotText(snapshot, "note"),
    line1: snapshotText(snapshot, "line1"),
    line2: snapshotText(snapshot, "line2"),
    city: snapshotText(snapshot, "city"),
    state: snapshotText(snapshot, "state_region", "state"),
    postalCode: snapshotText(snapshot, "postal_code", "postalCode", "zip"),
    country: snapshotText(snapshot, "country_code", "country")
  };
  return Object.values(address).some(Boolean) ? address : null;
}

function mapPickupLocation(
  value: DbPickupLocation | DbPickupLocation[] | null | undefined
): CustomerPickupLocation | null {
  const location = first(value);
  if (!location?.name) return null;
  const address = location.address ?? {};
  const line1 = snapshotText(address, "line1", "street");
  const line2 = snapshotText(address, "line2");
  const city = snapshotText(address, "city");
  const state = snapshotText(address, "state_region", "state");
  const postalCode = snapshotText(address, "postal_code", "postalCode", "zip");
  const country = snapshotText(address, "country_code", "country");
  const cityLine = [city, [state, postalCode].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(", ");
  return {
    name: location.name,
    addressLines: [line1, line2, cityLine || null, country && country !== "US" ? country : null]
      .filter((line): line is string => Boolean(line)),
    instructions: location.pickup_instructions?.trim() || null
  };
}

function statusCopy(order: {
  status: CustomerOrderStatus;
  fulfillmentMethod: CustomerFulfillment;
  pickupReadyAt: string | null;
  pickedUpAt: string | null;
  shippedAt: string | null;
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
      if (order.pickupReadyAt) {
        return {
          label: "Ready for pickup",
          detail:
            "Your order is ready at the store. Bring your order number and a photo ID to collect it.",
          isOpen: true
        };
      }
      return {
        label: "Preparing",
        detail: "We are preparing your order. We’ll mark it ready for pickup when it’s done.",
        isOpen: true
      };
    }
    if (order.shippedAt) {
      return {
        label: "Shipped",
        detail: "Your order has shipped and is on the way.",
        isOpen: true
      };
    }
    return { label: "Preparing shipment", detail: "Your order is being prepared for shipping.", isOpen: true };
  }
  return { label: "Draft", detail: "Not submitted yet.", isOpen: false };
}

function trackingUrl(carrier: string | null, tracking: string | null, explicit: string | null) {
  if (explicit?.trim()) return explicit.trim();
  if (!tracking?.trim()) return null;
  const code = encodeURIComponent(tracking.trim());
  switch (carrier?.toLowerCase()) {
    case "usps": return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${code}`;
    case "ups": return `https://www.ups.com/track?tracknum=${code}`;
    case "fedex": return `https://www.fedex.com/fedextrack/?trknbr=${code}`;
    case "dhl": return `https://www.dhl.com/us-en/home/tracking.html?tracking-id=${code}`;
    default: return null;
  }
}

function paymentInfo(row: DbOrder): {
  paidAt: string | null;
  paymentMethod: string | null;
  paymentStatus: CustomerOrder["paymentStatus"];
  invoiceNumber: string | null;
  amountPaid: number;
  balanceDue: number;
} {
  const invoices = asArray(row.invoices);
  const payments = invoices.flatMap((inv) => asArray(inv.payments));
  const succeeded = payments
    .filter((p) => p.status === "succeeded")
    .sort((a, b) => {
      const ta = new Date(a.received_at ?? a.created_at).getTime();
      const tb = new Date(b.received_at ?? b.created_at).getTime();
      return tb - ta;
    });

  const amountPaid = invoices.reduce((sum, inv) => sum + num(inv.amount_paid), 0);
  const balanceDue = invoices.length
    ? invoices.reduce(
        (sum, inv) =>
          sum +
          (inv.balance_due != null
            ? num(inv.balance_due)
            : Math.max(0, num(inv.total_amount) - num(inv.amount_paid))),
        0
      )
    : Math.max(0, num(row.total_amount) - amountPaid);
  const latest = succeeded[0];
  const paymentMethod = row.payment_method || latest?.payment_method || null;
  const invoiceNumber = invoices[0]?.invoice_number ?? null;
  const isPaid =
    Boolean(row.payment_confirmed_at) ||
    invoices.some((invoice) => invoice.status === "paid") ||
    (invoices.length > 0 && balanceDue <= 0.009);
  if (isPaid) {
    return {
      paidAt: row.payment_confirmed_at || latest?.received_at || latest?.created_at || null,
      paymentMethod,
      paymentStatus: "paid",
      invoiceNumber,
      amountPaid: amountPaid || num(row.total_amount),
      balanceDue: 0
    };
  }
  if (amountPaid > 0) {
    return {
      paidAt: null,
      paymentMethod,
      paymentStatus: "partial",
      invoiceNumber,
      amountPaid,
      balanceDue
    };
  }
  if (payments.some((p) => p.status === "pending")) {
    return { paidAt: null, paymentMethod, paymentStatus: "pending", invoiceNumber, amountPaid, balanceDue };
  }
  // Checkout thử hiện tại không tạo payment — coi như pending cho đơn còn mở.
  if (row.status === "confirmed") {
    return { paidAt: null, paymentMethod, paymentStatus: "pending", invoiceNumber, amountPaid, balanceDue };
  }
  if (row.status === "fulfilled") {
    // Đã hoàn tất nhưng chưa có bản ghi payment (pickup thử) — vẫn hiện pending.
    return { paidAt: null, paymentMethod, paymentStatus: "pending", invoiceNumber, amountPaid, balanceDue };
  }
  return { paidAt: null, paymentMethod, paymentStatus: "none", invoiceNumber, amountPaid, balanceDue };
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
      lineTotal,
      lineNote: item.line_note?.trim() || null
    };
  });

  const fulfillmentMethod = row.fulfillment_method ?? "pickup";
  const copy = statusCopy({
    status: row.status,
    fulfillmentMethod,
    pickupReadyAt: row.pickup_ready_at ?? null,
    pickedUpAt: row.picked_up_at,
    shippedAt: row.shipped_at
  });
  const payment = paymentInfo(row);

  return {
    id: row.id,
    number: row.order_number ?? row.id.slice(0, 8),
    status: row.status,
    fulfillmentMethod,
    subtotal: num(row.subtotal),
    discount: num(row.discount_amount),
    tax: num(row.tax_amount),
    shipping: num(row.shipping_amount),
    total: num(row.total_amount),
    currency: row.currency,
    placedAt: row.placed_at ?? row.created_at,
    createdAt: row.created_at,
    notes: row.notes,
    pickupReadyAt: row.pickup_ready_at ?? null,
    pickedUpAt: row.picked_up_at,
    shippedAt: row.shipped_at,
    fulfilledAt: row.fulfilled_at,
    cancelledAt: row.cancelled_at,
    cancelNote: row.cancel_note?.trim() || null,
    shippingCarrier: row.shipping_carrier?.trim() || null,
    trackingNumber: row.tracking_number?.trim() || null,
    trackingUrl: trackingUrl(row.shipping_carrier, row.tracking_number, row.tracking_url),
    shippingAddress: mapShippingAddress(row.shipping_address_snapshot),
    pickupLocation: mapPickupLocation(row.pickup_location),
    paidAt: payment.paidAt,
    paymentMethod: payment.paymentMethod,
    paymentStatus: payment.paymentStatus,
    paymentReference: row.payment_reference?.trim() || null,
    invoiceNumber: payment.invoiceNumber,
    amountPaid: payment.amountPaid,
    balanceDue: payment.balanceDue,
    itemCount: items.length,
    items,
    isOpen: copy.isOpen,
    statusLabel: copy.label,
    statusDetail: copy.detail
  };
}

async function getCustomerId(authUserId: string): Promise<string | null> {
  const supabase = createAdminClient();
  const { data: customer } = await supabase
    .from("customers")
    .select("id")
    .eq("auth_user_id", authUserId)
    .maybeSingle();
  return customer?.id ?? null;
}

/**
 * Đơn hàng của tài khoản đang đăng nhập (qua customers.auth_user_id).
 * Service role + filter theo user — khách chỉ thấy đơn của mình.
 */
export async function getOwnOrders(authUserId: string): Promise<CustomerOrder[]> {
  const customerId = await getCustomerId(authUserId);
  if (!customerId) return [];

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("sales_orders")
    .select(
      `id, order_number, status, fulfillment_method, subtotal, discount_amount, tax_amount, shipping_amount, total_amount, currency, placed_at, created_at, notes,
       pickup_ready_at, picked_up_at, shipped_at, fulfilled_at, cancelled_at, cancel_note,
       shipping_carrier, tracking_number, tracking_url, shipping_address_snapshot,
       payment_method, payment_reference, payment_confirmed_at,
       pickup_location:inventory_locations ( name, address, pickup_instructions ),
       items:sales_order_items ( id, product_name_snapshot, variant_name_snapshot, sku_snapshot, quantity, unit_price, line_total, line_note ),
       invoices ( id, invoice_number, amount_paid, balance_due, total_amount, status, payments ( received_at, status, amount, payment_method, created_at ) )`
    )
    .eq("customer_id", customerId)
    .neq("status", "draft")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) throw new Error(`Failed to load orders: ${error.message}`);
  return ((data ?? []) as unknown as DbOrder[]).map(mapOrder);
}

/** One non-draft order owned by this account, addressed by UUID or order number. */
export async function getOwnOrderByIdentifier(
  authUserId: string,
  identifier: string
): Promise<CustomerOrder | null> {
  const customerId = await getCustomerId(authUserId);
  const value = identifier.trim();
  if (!customerId || !value) return null;

  const supabase = createAdminClient();
  let query = supabase
    .from("sales_orders")
    .select(
      `id, order_number, status, fulfillment_method, subtotal, discount_amount, tax_amount, shipping_amount, total_amount, currency, placed_at, created_at, notes,
       pickup_ready_at, picked_up_at, shipped_at, fulfilled_at, cancelled_at, cancel_note,
       shipping_carrier, tracking_number, tracking_url, shipping_address_snapshot,
       payment_method, payment_reference, payment_confirmed_at,
       pickup_location:inventory_locations ( name, address, pickup_instructions ),
       items:sales_order_items ( id, product_name_snapshot, variant_name_snapshot, sku_snapshot, quantity, unit_price, line_total, line_note ),
       invoices ( id, invoice_number, amount_paid, balance_due, total_amount, status, payments ( received_at, status, amount, payment_method, created_at ) )`
    )
    .eq("customer_id", customerId)
    .neq("status", "draft");

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
  query = isUuid
    ? query.or(`id.eq.${value},order_number.eq.${value}`)
    : query.eq("order_number", value);

  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(`Failed to load order: ${error.message}`);
  return data ? mapOrder(data as unknown as DbOrder) : null;
}

/** Số đơn chưa hoàn tất (confirmed) — badge đỏ trên Account / Orders. */
export async function getOwnOpenOrderCount(authUserId: string): Promise<number> {
  const customerId = await getCustomerId(authUserId);
  if (!customerId) return 0;

  const supabase = createAdminClient();
  const { count, error } = await supabase
    .from("sales_orders")
    .select("id", { count: "exact", head: true })
    .eq("customer_id", customerId)
    .eq("status", "confirmed");

  if (error) return 0;
  return count ?? 0;
}
