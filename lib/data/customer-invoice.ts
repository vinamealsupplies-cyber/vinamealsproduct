import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export type InvoiceLine = {
  id: string;
  description: string;
  sku: string | null;
  quantity: number;
  unitPrice: number;
  amount: number;
  note: string | null;
};

export type InvoiceBillTo = {
  name: string;
  companyName: string | null;
  lines: string[];
  phone: string | null;
  email: string | null;
  customerNumber: string | null;
  isBusiness: boolean;
};

export type CustomerInvoiceView = {
  orderId: string;
  orderNumber: string;
  invoiceId: string | null;
  invoiceNumber: string;
  issueDate: string;
  status: string;
  fulfillmentMethod: "pickup" | "ship";
  paymentMethod: string | null;
  paymentStatus: "paid" | "pending" | "partial" | "none";
  paidAt: string | null;
  billTo: InvoiceBillTo;
  lines: InvoiceLine[];
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  shippingAmount: number;
  total: number;
  amountPaid: number;
  balanceDue: number;
  currency: string;
  notes: string | null;
};

function num(value: number | string | null | undefined): number {
  const parsed = typeof value === "string" ? Number.parseFloat(value) : value;
  return typeof parsed === "number" && Number.isFinite(parsed) ? parsed : 0;
}

type AddressSnap = {
  recipient_name?: string | null;
  company_name?: string | null;
  phone?: string | null;
  line1?: string | null;
  line2?: string | null;
  city?: string | null;
  state_region?: string | null;
  postal_code?: string | null;
  country_code?: string | null;
};

function formatAddressLines(snap: AddressSnap | null | undefined): string[] {
  if (!snap) return [];
  const lines: string[] = [];
  if (snap.line1) lines.push(snap.line1);
  if (snap.line2) lines.push(snap.line2);
  const cityLine = [snap.city, snap.state_region, snap.postal_code]
    .filter(Boolean)
    .join(", ")
    .replace(/,\s*,/g, ",");
  // "City, ST ZIP"
  const city = snap.city?.trim();
  const st = snap.state_region?.trim();
  const zip = snap.postal_code?.trim();
  if (city || st || zip) {
    lines.push([city, [st, zip].filter(Boolean).join(" ")].filter(Boolean).join(", "));
  } else if (cityLine) {
    lines.push(cityLine);
  }
  if (snap.country_code && snap.country_code !== "US") {
    lines.push(snap.country_code);
  }
  return lines;
}

/**
 * Full invoice document for the signed-in customer's order.
 * Ownership enforced via customers.auth_user_id.
 */
export async function getOwnOrderInvoice(
  authUserId: string,
  orderId: string
): Promise<CustomerInvoiceView | null> {
  const supabase = createAdminClient();

  const { data: customer } = await supabase
    .from("customers")
    .select(
      "id, customer_number, first_name, last_name, company_name, email, phone, customer_type"
    )
    .eq("auth_user_id", authUserId)
    .maybeSingle();
  if (!customer) return null;

  const { data: order, error } = await supabase
    .from("sales_orders")
    .select(
      `id, order_number, status, fulfillment_method, subtotal, discount_amount, tax_amount,
       shipping_amount, total_amount, currency, placed_at, created_at, notes,
       payment_method, payment_confirmed_at, shipping_address_snapshot,
       items:sales_order_items (
         id, product_name_snapshot, variant_name_snapshot, sku_snapshot,
         quantity, unit_price, line_total, line_note
       ),
       invoices (
         id, invoice_number, status, issue_date, issued_at, subtotal, discount_amount,
         tax_amount, shipping_amount, total_amount, amount_paid, balance_due, notes,
         payments ( received_at, status, amount, payment_method, created_at )
       )`
    )
    .eq("id", orderId)
    .eq("customer_id", customer.id)
    .maybeSingle();

  if (error || !order) return null;

  type Inv = {
    id: string;
    invoice_number: string | null;
    status: string;
    issue_date: string | null;
    issued_at: string | null;
    subtotal: number | string | null;
    discount_amount: number | string | null;
    tax_amount: number | string | null;
    shipping_amount: number | string | null;
    total_amount: number | string | null;
    amount_paid: number | string | null;
    balance_due: number | string | null;
    notes: string | null;
    payments:
      | {
          received_at: string | null;
          status: string;
          amount: number | string;
          payment_method: string | null;
          created_at: string;
        }[]
      | null;
  };

  const invoicesRaw = order.invoices as Inv[] | Inv | null;
  const invoices = !invoicesRaw
    ? []
    : Array.isArray(invoicesRaw)
      ? invoicesRaw
      : [invoicesRaw];
  const invoice = invoices[0] ?? null;

  const itemsRaw = order.items as
    | {
        id: string;
        product_name_snapshot: string;
        variant_name_snapshot: string | null;
        sku_snapshot: string;
        quantity: number | string;
        unit_price: number | string;
        line_total?: number | string;
        line_note: string | null;
      }[]
    | null;
  const items = itemsRaw ?? [];

  const lines: InvoiceLine[] = items.map((item) => {
    const quantity = num(item.quantity);
    const unitPrice = num(item.unit_price);
    const amount =
      item.line_total != null ? num(item.line_total) : quantity * unitPrice;
    const desc = [item.product_name_snapshot, item.variant_name_snapshot]
      .filter(Boolean)
      .join(" — ");
    return {
      id: item.id,
      description: desc,
      sku: item.sku_snapshot || null,
      quantity,
      unitPrice,
      amount,
      note: item.line_note?.trim() || null
    };
  });

  const shipSnap = order.shipping_address_snapshot as AddressSnap | null;
  const personName =
    [customer.first_name, customer.last_name].filter(Boolean).join(" ").trim() ||
    shipSnap?.recipient_name?.trim() ||
    "Customer";
  const isBusiness = customer.customer_type === "wholesale";
  const companyName =
    customer.company_name?.trim() || shipSnap?.company_name?.trim() || null;

  const fulfillment = (order.fulfillment_method === "ship" ? "ship" : "pickup") as
    | "pickup"
    | "ship";

  // Ship: show delivery address. Pickup: name (and company if business) only.
  const addressLines = fulfillment === "ship" ? formatAddressLines(shipSnap) : [];

  // Business: BILL TO company first (like sample). Retail: person name.
  const billTo: InvoiceBillTo = {
    name: isBusiness && companyName ? companyName : personName,
    companyName:
      isBusiness && companyName && personName && personName !== companyName
        ? personName
        : null,
    lines: addressLines,
    phone: customer.phone || shipSnap?.phone || null,
    email: customer.email || null,
    customerNumber: customer.customer_number,
    isBusiness
  };

  const payments = (invoice?.payments ?? []).filter((p) => p.status === "succeeded");
  const paidAt =
    order.payment_confirmed_at ||
    payments.sort((a, b) => {
      const ta = new Date(a.received_at ?? a.created_at).getTime();
      const tb = new Date(b.received_at ?? b.created_at).getTime();
      return tb - ta;
    })[0]?.received_at ||
    null;

  const total = invoice ? num(invoice.total_amount) : num(order.total_amount);
  const amountPaid = invoice ? num(invoice.amount_paid) : paidAt ? total : 0;
  const balanceDue = invoice?.balance_due != null
    ? num(invoice.balance_due)
    : Math.max(0, total - amountPaid);

  let paymentStatus: CustomerInvoiceView["paymentStatus"] = "none";
  if (invoice?.status === "paid" || balanceDue <= 0.009) paymentStatus = "paid";
  else if (amountPaid > 0) paymentStatus = "partial";
  else if (invoice || order.status === "confirmed") paymentStatus = "pending";

  const issueDate =
    invoice?.issue_date ||
    (invoice?.issued_at ? invoice.issued_at.slice(0, 10) : null) ||
    (order.placed_at ? String(order.placed_at).slice(0, 10) : null) ||
    String(order.created_at).slice(0, 10);

  return {
    orderId: order.id,
    orderNumber: order.order_number ?? order.id.slice(0, 8),
    invoiceId: invoice?.id ?? null,
    invoiceNumber:
      invoice?.invoice_number ||
      order.order_number ||
      order.id.slice(0, 8),
    issueDate,
    status: invoice?.status ?? order.status,
    fulfillmentMethod: fulfillment,
    paymentMethod: order.payment_method || payments[0]?.payment_method || null,
    paymentStatus,
    paidAt,
    billTo,
    lines,
    subtotal: invoice ? num(invoice.subtotal) : num(order.subtotal),
    discountAmount: invoice
      ? num(invoice.discount_amount)
      : num(order.discount_amount),
    taxAmount: invoice ? num(invoice.tax_amount) : num(order.tax_amount),
    shippingAmount: invoice
      ? num(invoice.shipping_amount)
      : num(order.shipping_amount),
    total,
    amountPaid,
    balanceDue,
    currency: order.currency || "USD",
    notes: invoice?.notes || order.notes
  };
}
