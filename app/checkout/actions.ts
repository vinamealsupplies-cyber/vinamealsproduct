"use server";

import { revalidatePath } from "next/cache";
import { getViewer } from "@/lib/auth";
import { getOwnShippingAddresses } from "@/lib/data/addresses";
import type { CustomerAddress } from "@/lib/data/address-types";
import { actorAuditMeta, writeAuditLog } from "@/lib/data/audit-log";
import { clearOwnCartItems } from "@/lib/data/cart";
import { getProducts } from "@/lib/data/products";
import { getOwnSpecialRequests } from "@/lib/data/special-requests";
import { recordSpecialRequestsBatch } from "@/lib/data/special-requests";
import { getOwnWholesaleAccount } from "@/lib/data/wholesale-account";
import { isSupabaseAdminConfigured } from "@/lib/env";
import { callerKey, checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import type { Product } from "@/lib/sample-data";
import type { SpecialRequest } from "@/lib/special-request-types";
import { createAdminClient } from "@/lib/supabase/admin";
import { toUserFacingError } from "@/lib/user-facing-error";
import { evaluateWholesaleEligibility } from "@/lib/wholesale";

// Checkout test: tạo sales_order confirmed + invoice PAID + payment succeeded
// để test Reports / Invoices / Payments (giả lập đã thu tiền, chưa Stripe thật).

const PICKUP_LOCATION_CODE = "STORE-PICKUP";
const LINE_NOTE_MAX = 300;

export type CheckoutItem = {
  productId: string;
  quantity: number;
  /** Yêu cầu đặc biệt cho món (tùy chọn). */
  note?: string;
};

export type CheckoutOptions = {
  fulfillmentMethod?: "pickup" | "ship";
  /** Bắt buộc khi ship — id customer_addresses của khách. */
  shippingAddressId?: string | null;
};

export type CheckoutResult =
  | {
      ok: true;
      orderNumber: string;
      invoiceNumber: string | null;
      total: number;
      fulfillmentMethod: "pickup" | "ship";
    }
  | { ok: false; error: string };

export type CheckoutBootstrap =
  | {
      ok: true;
      catalog: Product[];
      shippingAddresses: CustomerAddress[];
      specialRequests: SpecialRequest[];
      customerName: string;
    }
  | { ok: false; error: string; signedIn: boolean };

/** Client-side bootstrap so /checkout SSR stays tiny (avoids Worker/RSC crashes). */
export async function loadCheckoutBootstrap(): Promise<CheckoutBootstrap> {
  try {
    const viewer = await getViewer();
    if (!viewer || viewer.demo) {
      return { ok: false, error: "Please sign in to check out.", signedIn: false };
    }

    const canLoad = isSupabaseAdminConfigured();
    const [catalogR, addrR, reqR] = await Promise.allSettled([
      getProducts(),
      canLoad ? getOwnShippingAddresses(viewer.id) : Promise.resolve([] as CustomerAddress[]),
      canLoad ? getOwnSpecialRequests(viewer.id) : Promise.resolve([] as SpecialRequest[])
    ]);

    return {
      ok: true,
      catalog: catalogR.status === "fulfilled" ? catalogR.value : [],
      shippingAddresses: addrR.status === "fulfilled" ? addrR.value : [],
      specialRequests: reqR.status === "fulfilled" ? reqR.value : [],
      customerName: viewer.fullName || viewer.email || "Customer"
    };
  } catch (err) {
    return {
      ok: false,
      error: toUserFacingError(err, "Could not load checkout. Please try again."),
      signedIn: true
    };
  }
}

type VariantRow = {
  id: string;
  sku: string;
  retail_price: number | string;
  sale_price: number | string | null;
  wholesale_price: number | string | null;
  cost_price: number | string | null;
  is_default: boolean;
  is_active: boolean;
};

type ProductRow = {
  id: string;
  name: string;
  status: string;
  product_variants: VariantRow[];
};

function num(value: number | string | null | undefined): number {
  const parsed = typeof value === "string" ? Number.parseFloat(value) : value;
  return typeof parsed === "number" && Number.isFinite(parsed) ? parsed : 0;
}

function cleanNote(note: unknown): string | null {
  if (typeof note !== "string") return null;
  const trimmed = note.trim().slice(0, LINE_NOTE_MAX);
  return trimmed || null;
}

export async function placeTestOrder(
  items: CheckoutItem[],
  options: CheckoutOptions = {}
): Promise<CheckoutResult> {
  try {
    return await placeTestOrderInner(items, options);
  } catch (err) {
    return {
      ok: false,
      error: toUserFacingError(err, "Could not place the order. Try again.")
    };
  }
}

async function placeTestOrderInner(
  items: CheckoutItem[],
  options: CheckoutOptions = {}
): Promise<CheckoutResult> {
  const viewer = await getViewer();
  if (!viewer || viewer.demo) {
    return { ok: false, error: "Please sign in to place an order." };
  }
  if (!Array.isArray(items) || items.length === 0) {
    return { ok: false, error: "Your cart is empty." };
  }
  if (!(await checkRateLimit(await callerKey("checkout", viewer.id), RATE_LIMITS.mutation))) {
    return { ok: false, error: "Too many attempts. Wait a minute and try again." };
  }

  const fulfillmentMethod: "pickup" | "ship" =
    options.fulfillmentMethod === "ship" ? "ship" : "pickup";
  const shippingAddressId = options.shippingAddressId?.trim() || null;

  // Gộp trùng productId: cộng qty, gộp ghi chú (nếu khác nhau).
  const wanted = new Map<string, { quantity: number; notes: string[] }>();
  for (const item of items) {
    const id = String(item?.productId ?? "").trim();
    const qty = Math.floor(Number(item?.quantity));
    if (!id || !Number.isFinite(qty) || qty <= 0) continue;
    const note = cleanNote(item?.note);
    const existing = wanted.get(id);
    if (existing) {
      existing.quantity += qty;
      if (note && !existing.notes.includes(note)) existing.notes.push(note);
    } else {
      wanted.set(id, { quantity: qty, notes: note ? [note] : [] });
    }
  }
  if (wanted.size === 0) return { ok: false, error: "Invalid cart." };

  const supabase = createAdminClient();
  const wholesaleAccount = await getOwnWholesaleAccount(viewer.id);

  const { data: productRows, error: prodErr } = await supabase
    .from("products")
    .select(
      "id, name, status, product_variants ( id, sku, retail_price, sale_price, wholesale_price, cost_price, is_default, is_active )"
    )
    .in("id", [...wanted.keys()]);
  if (prodErr) return { ok: false, error: "Could not load products. Try again." };

  // Tính total qty + wholesale subtotal trước để quyết định qualifies.
  let cartQuantity = 0;
  let wholesaleCartAmount = 0;
  const priced: {
    row: ProductRow;
    variant: VariantRow;
    quantity: number;
    notes: string[];
    retailUnit: number;
    wholesaleUnit: number;
  }[] = [];

  for (const row of (productRows ?? []) as unknown as ProductRow[]) {
    if (row.status !== "active") continue;
    const wantedLine = wanted.get(row.id);
    if (!wantedLine) continue;
    const variants = row.product_variants ?? [];
    const variant =
      variants.find((v) => v.is_default) ?? variants.find((v) => v.is_active) ?? variants[0];
    if (!variant) continue;

    const retail = num(variant.retail_price);
    const rawSale =
      variant.sale_price == null || variant.sale_price === "" ? null : num(variant.sale_price);
    const retailUnit = rawSale != null && rawSale >= 0 && rawSale < retail ? rawSale : retail;
    const wholesaleRaw =
      variant.wholesale_price == null || variant.wholesale_price === ""
        ? null
        : num(variant.wholesale_price);
    const wholesaleUnit =
      wholesaleRaw != null && wholesaleRaw >= 0 ? wholesaleRaw : retailUnit;

    cartQuantity += wantedLine.quantity;
    wholesaleCartAmount += wholesaleUnit * wantedLine.quantity;
    priced.push({
      row,
      variant,
      quantity: wantedLine.quantity,
      notes: wantedLine.notes,
      retailUnit,
      wholesaleUnit
    });
  }

  if (priced.length === 0) return { ok: false, error: "No valid products in the cart." };

  const eligibility = evaluateWholesaleEligibility(
    wholesaleAccount,
    cartQuantity,
    wholesaleCartAmount
  );
  const useWholesale = eligibility.qualifies;

  const orderItems = priced.map((line) => ({
    product_id: line.row.id,
    variant_id: line.variant.id ?? null,
    product_name_snapshot: line.row.name,
    sku_snapshot: line.variant.sku ?? "",
    quantity: line.quantity,
    unit_price: useWholesale ? line.wholesaleUnit : line.retailUnit,
    unit_cost_snapshot: num(line.variant.cost_price),
    line_note: line.notes.length ? line.notes.join("; ").slice(0, LINE_NOTE_MAX) : null
  }));

  // Đồng bộ họ tên + SĐT từ profile (không hiện email trên Orders).
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, phone, email")
    .eq("id", viewer.id)
    .maybeSingle();
  const fullName = (profile?.full_name ?? viewer.fullName ?? "").trim();
  const nameParts = fullName ? fullName.split(/\s+/) : [];
  const firstName = nameParts[0] || null;
  const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : null;
  const phone = (profile?.phone ?? "").trim() || null;

  let customerId: string | null = null;
  const { data: existingCustomer } = await supabase
    .from("customers")
    .select("id, first_name, last_name, phone")
    .eq("auth_user_id", viewer.id)
    .maybeSingle();
  customerId = existingCustomer?.id ?? null;
  if (!customerId) {
    const { data: createdCustomer } = await supabase
      .from("customers")
      .insert({
        auth_user_id: viewer.id,
        email: viewer.email || profile?.email || null,
        first_name: firstName,
        last_name: lastName,
        phone,
        customer_type: "retail",
        status: "active"
      })
      .select("id")
      .single();
    customerId = createdCustomer?.id ?? null;
  } else {
    // Bổ sung tên/SĐT nếu hồ sơ khách còn trống.
    const patch: Record<string, string> = {};
    if (!existingCustomer?.first_name && firstName) patch.first_name = firstName;
    if (!existingCustomer?.last_name && lastName) patch.last_name = lastName;
    if (!existingCustomer?.phone && phone) patch.phone = phone;
    if (Object.keys(patch).length) {
      await supabase.from("customers").update(patch).eq("id", customerId);
    }
  }

  if (!customerId) return { ok: false, error: "Could not create a customer profile. Try again." };

  const SHIPPING_FLAT_RATE = 12.5;
  let pickupLocationId: string | null = null;
  let shippingAmount = 0;
  let shippingSnapshot: Record<string, unknown> | null = null;

  if (fulfillmentMethod === "pickup") {
    const { data: location } = await supabase
      .from("inventory_locations")
      .select("id")
      .eq("code", PICKUP_LOCATION_CODE)
      .maybeSingle();
    if (!location?.id) {
      return { ok: false, error: "Pickup location is not configured (STORE-PICKUP)." };
    }
    pickupLocationId = location.id;
    shippingAmount = 0;
  } else {
    if (!shippingAddressId) {
      return { ok: false, error: "Select a shipping address for delivery." };
    }
    const { data: address } = await supabase
      .from("customer_addresses")
      .select(
        "id, customer_id, recipient_name, company_name, phone, line1, line2, city, state_region, postal_code, country_code"
      )
      .eq("id", shippingAddressId)
      .eq("customer_id", customerId)
      .maybeSingle();
    if (!address) {
      return { ok: false, error: "Invalid shipping address." };
    }
    shippingAmount = SHIPPING_FLAT_RATE;
    shippingSnapshot = {
      recipient_name: address.recipient_name,
      company_name: address.company_name,
      phone: address.phone,
      line1: address.line1,
      line2: address.line2,
      city: address.city,
      state_region: address.state_region,
      postal_code: address.postal_code,
      country_code: address.country_code
    };
  }

  const subtotal = orderItems.reduce((sum, item) => sum + item.unit_price * item.quantity, 0);
  const taxAmount = 0; // Stripe Tax / sales tax phase sau.
  const total = subtotal + shippingAmount + taxAmount;
  const now = new Date().toISOString();
  const issueDate = now.slice(0, 10); // YYYY-MM-DD

  const { data: order, error: orderErr } = await supabase
    .from("sales_orders")
    .insert({
      customer_id: customerId,
      channel: "web",
      status: "confirmed",
      currency: "USD",
      fulfillment_method: fulfillmentMethod,
      pickup_location_id: pickupLocationId,
      shipping_amount: shippingAmount,
      shipping_address_snapshot: shippingSnapshot,
      subtotal,
      tax_amount: taxAmount,
      total_amount: total,
      placed_at: now,
      created_by: viewer.id,
      notes: useWholesale
        ? `Web order (${fulfillmentMethod}, wholesale). Paid in full (test checkout).`
        : `Web order (${fulfillmentMethod}). Paid in full (test checkout).`
    })
    .select("id, order_number")
    .single();
  if (orderErr || !order) {
    return { ok: false, error: orderErr?.message || "Could not create the order. Try again." };
  }

  const { error: itemsErr } = await supabase
    .from("sales_order_items")
    .insert(orderItems.map((item) => ({ ...item, order_id: order.id })));
  if (itemsErr) {
    await supabase.from("sales_orders").delete().eq("id", order.id);
    if (itemsErr.message.includes("line_note")) {
      return {
        ok: false,
        error: "Database is missing line_note. Run migration 20260728210000_order_item_line_note.sql."
      };
    }
    return { ok: false, error: "Could not save order lines. Try again." };
  }

  // --- Invoice + payment (đã thu đủ) để Reports / Invoices / Payments có số ---
  const orderId = order.id as string;
  async function rollbackOrder() {
    await supabase.from("sales_orders").delete().eq("id", orderId);
  }

  const { data: invoice, error: invErr } = await supabase
    .from("invoices")
    .insert({
      order_id: orderId,
      customer_id: customerId,
      status: "issued",
      currency: "USD",
      issue_date: issueDate,
      due_date: issueDate,
      subtotal,
      discount_amount: 0,
      tax_amount: taxAmount,
      shipping_amount: shippingAmount,
      total_amount: total,
      amount_paid: 0,
      fulfillment_method: fulfillmentMethod,
      tax_exempt_snapshot: false,
      billing_address_snapshot: shippingSnapshot,
      notes: `Auto-invoice for ${order.order_number} (test paid checkout).`,
      issued_at: now,
      created_by: viewer.id
    })
    .select("id, invoice_number, total_amount")
    .single();

  if (invErr || !invoice) {
    await rollbackOrder();
    return {
      ok: false,
      error: invErr?.message || "Could not create the invoice. Try again."
    };
  }

  const { error: invItemsErr } = await supabase.from("invoice_items").insert(
    orderItems.map((item) => ({
      invoice_id: invoice.id,
      product_id: item.product_id,
      variant_id: item.variant_id,
      product_name_snapshot: item.product_name_snapshot,
      sku_snapshot: item.sku_snapshot,
      quantity: item.quantity,
      unit_price: item.unit_price,
      unit_cost_snapshot: item.unit_cost_snapshot,
      discount_amount: 0,
      tax_rate_snapshot: 0,
      tax_amount: 0
    }))
  );
  if (invItemsErr) {
    await supabase.from("invoices").delete().eq("id", invoice.id);
    await rollbackOrder();
    return { ok: false, error: "Could not save invoice lines. Try again." };
  }

  // Re-read total after item triggers recalculate (avoids amount mismatch).
  const { data: invFresh } = await supabase
    .from("invoices")
    .select("id, invoice_number, total_amount")
    .eq("id", invoice.id)
    .maybeSingle();
  const payAmount = Math.max(num(invFresh?.total_amount ?? total), 0.01);

  const { data: payment, error: payErr } = await supabase
    .from("payments")
    .insert({
      invoice_id: invoice.id,
      payment_kind: "payment",
      status: "succeeded",
      amount: payAmount,
      currency: "USD",
      payment_method: "test_checkout",
      provider: "vinameals_test",
      provider_payment_id: `test_${orderId}`,
      reference: order.order_number,
      received_at: now,
      notes: "Test checkout — paid in full (not real Stripe).",
      created_by: viewer.id
    })
    .select("id")
    .single();

  if (payErr || !payment) {
    await supabase.from("payments").delete().eq("invoice_id", invoice.id);
    await supabase.from("invoices").delete().eq("id", invoice.id);
    await rollbackOrder();
    return {
      ok: false,
      error: payErr?.message || "Could not record payment. Try again."
    };
  }

  // One audit entry only (keeps Worker CPU lower).
  await writeAuditLog({
    actorUserId: viewer.id,
    action: "order.create_paid",
    entityType: "sales_order",
    entityId: orderId,
    after: {
      orderNumber: order.order_number,
      status: "confirmed",
      fulfillmentMethod,
      total: payAmount,
      invoiceNumber: invFresh?.invoice_number ?? invoice.invoice_number,
      paymentId: payment.id,
      paid: true
    },
    metadata: {
      ...actorAuditMeta(viewer),
      orderNumber: order.order_number,
      invoiceNumber: invFresh?.invoice_number ?? invoice.invoice_number,
      wholesaleApplied: useWholesale,
      fulfillmentMethod,
      paid: true
    }
  });

  // Best-effort: special requests + clear cart (must not fail the order).
  try {
    await recordSpecialRequestsBatch(
      viewer.id,
      orderItems.map((i) => i.line_note).filter((n): n is string => Boolean(n))
    );
  } catch {
    /* ignore */
  }
  try {
    await clearOwnCartItems(viewer.id);
  } catch {
    /* ignore */
  }

  revalidatePath("/admin/orders");
  revalidatePath("/admin/invoices");
  revalidatePath("/admin/payments");
  revalidatePath("/admin/reports");
  revalidatePath("/admin");
  revalidatePath("/account");
  revalidatePath("/cart");
  revalidatePath("/checkout");
  return {
    ok: true,
    orderNumber: order.order_number ?? orderId,
    invoiceNumber: invFresh?.invoice_number ?? invoice.invoice_number ?? null,
    total: payAmount,
    fulfillmentMethod
  };
}
