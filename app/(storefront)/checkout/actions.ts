"use server";

import { revalidatePath } from "next/cache";
import { getViewer } from "@/lib/auth";
import {
  computeBusinessDiscount,
  isBusinessPaymentMethod,
  isOfflinePaymentMethod,
  PAYMENT_INSTRUCTIONS,
  type BusinessPaymentMethod,
  type OfflinePaymentMethod
} from "@/lib/business-order";
import { getOwnBusinessAccount } from "@/lib/data/business-account";
import { getOwnShippingAddresses } from "@/lib/data/addresses";
import type { CustomerAddress } from "@/lib/data/address-types";
import { actorAuditMeta, writeAuditLog } from "@/lib/data/audit-log";
import { clearOwnCartItems } from "@/lib/data/cart";
import { getProducts } from "@/lib/data/products";
import { getOwnSpecialRequests } from "@/lib/data/special-requests";
import { recordSpecialRequestsBatch } from "@/lib/data/special-requests";
import { getStoreBusinessProfile } from "@/lib/data/store-settings";
import { normalizeUsPhone } from "@/lib/data/us-states";
import { computeOrderTax, type TaxCategory, type TaxInputLine } from "@/lib/tax/compute-order-tax";
import { isSupabaseAdminConfigured } from "@/lib/env";
import { callerKey, checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import type { Product } from "@/lib/sample-data";
import type { SpecialRequest } from "@/lib/special-request-types";
import {
  defaultStoreBusinessProfile,
  type StoreBusinessProfile
} from "@/lib/store-profile";
import { createAdminClient } from "@/lib/supabase/admin";
import { toUserFacingError } from "@/lib/user-facing-error";

// Web checkout: retail/sale unit prices + optional business discount %.
// Offline payment (check / Zelle / bank transfer) → invoice issued, unpaid.
// Admin confirms payment later (no auto-paid test checkout).

const PICKUP_LOCATION_CODE = "STORE-PICKUP";
const LINE_NOTE_MAX = 300;
const SHIPPING_FLAT_RATE = 12.5;

export type CheckoutItem = {
  productId: string;
  quantity: number;
  note?: string;
};

export type CheckoutOptions = {
  fulfillmentMethod?: "pickup" | "ship";
  shippingAddressId?: string | null;
  paymentMethod?: BusinessPaymentMethod | OfflinePaymentMethod | string;
  paymentReference?: string | null;
  /**
   * Phone entered at checkout. Used when the account has none saved yet —
   * it is stored back on the profile/customer for next time.
   */
  phone?: string | null;
  /**
   * Test path: create invoice + payment succeeded immediately
   * (same as the old “test checkout” for Orders / Invoices / Reports).
   */
  forcePaidTest?: boolean;
};

export type CheckoutResult =
  | {
      ok: true;
      orderNumber: string;
      invoiceNumber: string | null;
      total: number;
      discountAmount: number;
      fulfillmentMethod: "pickup" | "ship";
      /** Business: card | offline; retail / test may be null. */
      paymentMethod: BusinessPaymentMethod | OfflinePaymentMethod | null;
      paymentInstructions: string | null;
      awaitingPayment: boolean;
      isBusinessOrder: boolean;
      /** True when forcePaidTest was used. */
      isTestPaid?: boolean;
    }
  | { ok: false; error: string };

export type CheckoutBootstrap =
  | {
      ok: true;
      catalog: Product[];
      shippingAddresses: CustomerAddress[];
      specialRequests: SpecialRequest[];
      customerName: string;
      /** Phone already on the account, or null when none is saved yet. */
      phone: string | null;
      isBusiness: boolean;
      businessDiscountPercent: number | null;
      companyName: string | null;
      /** Seller pay-to details for offline methods (Zelle / bank / check). */
      storeProfile: StoreBusinessProfile;
    }
  | { ok: false; error: string; signedIn: boolean };

export async function loadCheckoutBootstrap(): Promise<CheckoutBootstrap> {
  try {
    const viewer = await getViewer();
    if (!viewer || viewer.demo) {
      return { ok: false, error: "Please sign in to check out.", signedIn: false };
    }

    const canLoad = isSupabaseAdminConfigured();
    const admin = canLoad ? createAdminClient() : null;
    const viewerId = viewer.id;

    async function loadPhone(): Promise<string | null> {
      if (!admin) return null;
      const { data } = await admin
        .from("profiles")
        .select("phone")
        .eq("id", viewerId)
        .maybeSingle();
      return (data?.phone ?? "").trim() || null;
    }

    const [catalogR, addrR, reqR, bizR, storeR, phoneR] = await Promise.allSettled([
      getProducts(),
      canLoad ? getOwnShippingAddresses(viewer.id) : Promise.resolve([] as CustomerAddress[]),
      canLoad ? getOwnSpecialRequests(viewer.id) : Promise.resolve([] as SpecialRequest[]),
      canLoad ? getOwnBusinessAccount(viewer.id) : Promise.resolve(null),
      canLoad ? getStoreBusinessProfile() : Promise.resolve(null),
      loadPhone()
    ]);

    const biz = bizR.status === "fulfilled" ? bizR.value : null;
    const storeProfile =
      storeR.status === "fulfilled" && storeR.value
        ? storeR.value
        : defaultStoreBusinessProfile();

    return {
      ok: true,
      catalog: catalogR.status === "fulfilled" ? catalogR.value : [],
      shippingAddresses: addrR.status === "fulfilled" ? addrR.value : [],
      specialRequests: reqR.status === "fulfilled" ? reqR.value : [],
      customerName: viewer.fullName || viewer.email || "Customer",
      phone: phoneR.status === "fulfilled" ? phoneR.value : null,
      isBusiness: Boolean(biz?.isBusiness),
      businessDiscountPercent: biz?.discountPercent ?? null,
      companyName: biz?.companyName ?? null,
      storeProfile
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
  cost_price: number | string | null;
  is_default: boolean;
  is_active: boolean;
  taxable: boolean | null;
  tax_category: string | null;
};

type ProductRow = {
  id: string;
  name: string;
  status: string;
  product_variants: VariantRow[];
  product_categories:
    | { is_primary: boolean; categories: { tax_category: string | null } | null }[]
    | null;
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

/** @deprecated use placeOrder — kept for any old client bundles. */
export async function placeTestOrder(
  items: CheckoutItem[],
  options: CheckoutOptions = {}
): Promise<CheckoutResult> {
  return placeOrder(items, options);
}

export async function placeOrder(
  items: CheckoutItem[],
  options: CheckoutOptions = {}
): Promise<CheckoutResult> {
  try {
    return await placeOrderInner(items, options);
  } catch (err) {
    return {
      ok: false,
      error: toUserFacingError(err, "Could not place the order. Try again.")
    };
  }
}

async function placeOrderInner(
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

  const supabase = createAdminClient();
  const business = await getOwnBusinessAccount(viewer.id);
  const isBusinessAccount = Boolean(business?.isBusiness);
  const forcePaidTest = Boolean(options.forcePaidTest);

  // Business: card (like retail) + offline check/Zelle/bank.
  // Retail: no payment method UI (Stripe later / test paid).
  // forcePaidTest skips selection and marks paid for testing.
  let paymentMethod: BusinessPaymentMethod | null = null;
  let paymentReference: string | null = null;
  if (isBusinessAccount && !forcePaidTest) {
    if (!isBusinessPaymentMethod(options.paymentMethod)) {
      return {
        ok: false,
        error: "Select a payment method: card, check, Zelle, or bank transfer."
      };
    }
    paymentMethod = options.paymentMethod;
    paymentReference = String(options.paymentReference ?? "")
      .trim()
      .slice(0, 120) || null;
  }

  const fulfillmentMethod: "pickup" | "ship" =
    options.fulfillmentMethod === "ship" ? "ship" : "pickup";
  const shippingAddressId = options.shippingAddressId?.trim() || null;

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

  const { data: productRows, error: prodErr } = await supabase
    .from("products")
    .select(
      "id, name, status, product_variants ( id, sku, retail_price, sale_price, cost_price, is_default, is_active, taxable, tax_category ), product_categories ( is_primary, categories ( tax_category ) )"
    )
    .in("id", [...wanted.keys()]);
  if (prodErr) return { ok: false, error: "Could not load products. Try again." };

  const orderItems: {
    product_id: string;
    variant_id: string | null;
    product_name_snapshot: string;
    sku_snapshot: string;
    quantity: number;
    unit_price: number;
    unit_cost_snapshot: number;
    line_note: string | null;
    discount_amount: number;
    tax_amount: number;
    tax_rate_snapshot: number;
  }[] = [];
  // Aligned 1:1 with orderItems — the taxability inputs per line for sales tax.
  const taxLines: TaxInputLine[] = [];

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
    const unitPrice = rawSale != null && rawSale >= 0 && rawSale < retail ? rawSale : retail;

    orderItems.push({
      product_id: row.id,
      variant_id: variant.id ?? null,
      product_name_snapshot: row.name,
      sku_snapshot: variant.sku ?? "",
      quantity: wantedLine.quantity,
      unit_price: unitPrice,
      unit_cost_snapshot: num(variant.cost_price),
      line_note: wantedLine.notes.length
        ? wantedLine.notes.join("; ").slice(0, LINE_NOTE_MAX)
        : null,
      discount_amount: 0,
      tax_amount: 0,
      tax_rate_snapshot: 0
    });
    // Tax class comes from the product's primary category (Costco-style:
    // food/drinks tax-free, household taxable); fall back to the variant.
    const cats = row.product_categories ?? [];
    const primaryCat = cats.find((c) => c.is_primary) ?? cats[0];
    const resolvedTax = primaryCat?.categories?.tax_category ?? variant.tax_category ?? "grocery";
    const category: TaxCategory =
      resolvedTax === "general" || resolvedTax === "prepared_food" ? resolvedTax : "grocery";
    taxLines.push({
      amount: unitPrice * wantedLine.quantity,
      taxable: variant.taxable !== false,
      category
    });
  }

  if (orderItems.length === 0) return { ok: false, error: "No valid products in the cart." };

  const merchandiseSubtotal = orderItems.reduce(
    (sum, item) => sum + item.unit_price * item.quantity,
    0
  );

  // Business discount % only for approved business accounts.
  const discountPercent = business?.isBusiness ? business.discountPercent : null;
  const discountAmount = computeBusinessDiscount(merchandiseSubtotal, discountPercent);

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, phone, email")
    .eq("id", viewer.id)
    .maybeSingle();
  const fullName = (profile?.full_name ?? viewer.fullName ?? "").trim();
  const nameParts = fullName ? fullName.split(/\s+/) : [];
  const firstName = nameParts[0] || null;
  const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : null;

  // Phone: use what the account already has; otherwise take what the customer
  // typed at checkout, validate it, and save it back for next time.
  const savedPhone = (profile?.phone ?? "").trim() || null;
  let phone = savedPhone;
  let phoneToPersist: string | null = null;
  if (!savedPhone) {
    const entered = String(options.phone ?? "").trim();
    if (!entered) {
      return { ok: false, error: "Please enter a phone number so we can reach you about this order." };
    }
    const normalized = normalizeUsPhone(entered);
    if (!normalized) {
      return { ok: false, error: "Please enter a valid U.S. phone number." };
    }
    phone = normalized;
    phoneToPersist = normalized;
  }

  // Persist the new phone onto the account profile for future orders.
  if (phoneToPersist) {
    await supabase.from("profiles").update({ phone: phoneToPersist }).eq("id", viewer.id);
  }

  let customerId: string | null = null;
  const { data: existingCustomer } = await supabase
    .from("customers")
    .select(
      "id, first_name, last_name, phone, tax_exempt_status, tax_exempt_effective_at, tax_exempt_expires_at"
    )
    .eq("auth_user_id", viewer.id)
    .maybeSingle();
  customerId = existingCustomer?.id ?? null;

  // Approved & currently-effective resale/tax exemption → collect no sales tax.
  const todayStr = new Date().toISOString().slice(0, 10);
  const taxExempt =
    existingCustomer?.tax_exempt_status === "approved" &&
    (!existingCustomer.tax_exempt_effective_at ||
      existingCustomer.tax_exempt_effective_at <= todayStr) &&
    (!existingCustomer.tax_exempt_expires_at || existingCustomer.tax_exempt_expires_at >= todayStr);
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
    const patch: Record<string, string> = {};
    if (!existingCustomer?.first_name && firstName) patch.first_name = firstName;
    if (!existingCustomer?.last_name && lastName) patch.last_name = lastName;
    // Save the phone when the customer record has none (new or newly entered).
    if (!existingCustomer?.phone && phone) patch.phone = phone;
    if (Object.keys(patch).length) {
      await supabase.from("customers").update(patch).eq("id", customerId);
    }
  }

  if (!customerId) return { ok: false, error: "Could not create a customer profile. Try again." };

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

  // ---- Sales tax (CDTFA) ----------------------------------------------------
  // Tax situs: ship-to address for delivery; store location for pickup.
  let taxCountry = "US";
  let taxState = "";
  let taxCity: string | null = null;
  let taxZip = "";
  let taxAddressText: string | null = null;
  if (fulfillmentMethod === "ship" && shippingSnapshot) {
    taxCountry = String(shippingSnapshot.country_code ?? "US") || "US";
    taxState = String(shippingSnapshot.state_region ?? "").toUpperCase();
    taxCity = String(shippingSnapshot.city ?? "") || null;
    taxZip = String(shippingSnapshot.postal_code ?? "");
    taxAddressText =
      [
        shippingSnapshot.line1,
        shippingSnapshot.line2,
        shippingSnapshot.city,
        shippingSnapshot.state_region,
        shippingSnapshot.postal_code
      ]
        .filter(Boolean)
        .join(", ") || null;
  } else {
    const store = (await getStoreBusinessProfile().catch(() => null)) ?? defaultStoreBusinessProfile();
    taxCountry = "US";
    taxState = (store.state ?? "").toUpperCase();
    taxCity = store.city ?? null;
    taxZip = store.postalCode ?? "";
    taxAddressText =
      [store.addressLine1, store.city, store.state, store.postalCode].filter(Boolean).join(", ") ||
      null;
  }

  let jurisdictionRows: Parameters<typeof computeOrderTax>[0]["stateRows"] = [];
  if (taxState) {
    const { data: jRows } = await supabase
      .from("tax_jurisdictions")
      .select("id, state_code, city, county, zip, general_rate, grocery_rate, prepared_food_rate")
      .eq("state_code", taxState)
      .eq("is_active", true);
    jurisdictionRows = (jRows ?? []) as typeof jurisdictionRows;
  }

  const taxResult = computeOrderTax({
    stateRows: jurisdictionRows,
    city: taxCity,
    lines: taxLines,
    exempt: taxExempt
  });
  // Push the per-line tax onto the order items so the invoice/order totals
  // (recalculated by DB triggers from the item rows) include it.
  taxResult.lines.forEach((line, index) => {
    if (orderItems[index]) {
      orderItems[index].tax_amount = line.tax;
      orderItems[index].tax_rate_snapshot = line.rate;
    }
  });
  const taxSummary = taxResult.summary;
  const taxAmount = taxSummary.salesTaxCollected;

  const subtotal = merchandiseSubtotal;
  const total = Math.max(0, subtotal - discountAmount + shippingAmount + taxAmount);
  const now = new Date().toISOString();
  const issueDate = now.slice(0, 10);
  const isBusinessOrder = isBusinessAccount;
  // Offline methods need staff confirm; card follows retail path (test-paid until Stripe).
  const payByCard = paymentMethod === "card";
  const awaitingPayment =
    isBusinessOrder && !forcePaidTest && isOfflinePaymentMethod(paymentMethod);

  const noteParts = forcePaidTest
    ? [
        `Web order (${fulfillmentMethod}).`,
        "Test checkout — paid in full (not real Stripe).",
        isBusinessOrder ? "Business account (test paid)." : "Retail test paid."
      ]
    : isBusinessOrder
      ? [
          `Web order (${fulfillmentMethod}).`,
          paymentMethod ? `Pay by ${paymentMethod.replace("_", " ")}.` : null,
          awaitingPayment ? "Awaiting payment confirmation." : null,
          payByCard ? "Card payment (Stripe path — test paid until Stripe is live)." : null,
          "Business discount order.",
          discountPercent != null && discountPercent > 0
            ? `Business discount ${discountPercent}%.`
            : null,
          paymentReference ? `Customer ref: ${paymentReference}` : null
        ]
      : [`Web order (${fulfillmentMethod}).`, "Retail order."];

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
      discount_amount: discountAmount,
      tax_amount: taxAmount,
      total_amount: total,
      payment_method: forcePaidTest
        ? "test_checkout"
        : isBusinessOrder
          ? paymentMethod
          : null,
      payment_reference: forcePaidTest ? null : isBusinessOrder ? paymentReference : null,
      placed_at: now,
      created_by: viewer.id,
      notes: noteParts.filter(Boolean).join(" ")
    })
    .select("id, order_number")
    .single();

  if (orderErr || !order) {
    if (orderErr?.message?.includes("payment_method")) {
      return {
        ok: false,
        error:
          "Database needs migration 20260729140000_business_offline_payment.sql (payment_method)."
      };
    }
    return { ok: false, error: orderErr?.message || "Could not create the order. Try again." };
  }

  const { error: itemsErr } = await supabase
    .from("sales_order_items")
    .insert(orderItems.map((item) => ({ ...item, order_id: order.id })));
  if (itemsErr) {
    await supabase.from("sales_orders").delete().eq("id", order.id);
    return { ok: false, error: "Could not save order lines. Try again." };
  }

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
      discount_amount: discountAmount,
      tax_amount: taxAmount,
      shipping_amount: shippingAmount,
      total_amount: total,
      amount_paid: 0,
      fulfillment_method: fulfillmentMethod,
      tax_exempt_snapshot: taxExempt,
      billing_address_snapshot: shippingSnapshot,
      notes: forcePaidTest
        ? `Invoice for ${order.order_number} (test paid checkout).`
        : isBusinessOrder
          ? `Invoice for ${order.order_number} — pay by ${paymentMethod}, awaiting confirmation.`
          : `Invoice for ${order.order_number}.`,
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
      tax_rate_snapshot: item.tax_rate_snapshot,
      tax_amount: item.tax_amount
    }))
  );
  if (invItemsErr) {
    await supabase.from("invoices").delete().eq("id", invoice.id);
    await rollbackOrder();
    return { ok: false, error: "Could not save invoice lines. Try again." };
  }

  // Re-read total after item triggers (if any).
  const { data: invFresh } = await supabase
    .from("invoices")
    .select("id, invoice_number, total_amount")
    .eq("id", invoice.id)
    .maybeSingle();
  const payAmount = Math.max(num(invFresh?.total_amount ?? total), 0.01);

  // CDTFA per-order tax snapshot. Best-effort: reporting only, never blocks the
  // order (tax already landed on the invoice/order via the item rows).
  const { error: taxRecErr } = await supabase.from("order_tax_records").insert({
    order_id: orderId,
    invoice_id: invoice.id,
    customer_id: customerId,
    order_number: order.order_number,
    order_date: issueDate,
    placed_at: now,
    fulfillment_method: fulfillmentMethod,
    country_code: taxCountry,
    state_code: taxState || null,
    county: taxSummary.county,
    city: taxCity,
    zip: taxZip || null,
    shipping_address: taxAddressText,
    gross_sales: taxSummary.grossSales,
    taxable_subtotal: taxSummary.taxableSubtotal,
    shipping_amount: shippingAmount,
    shipping_taxable_amount: 0,
    tax_exempt_amount: taxSummary.taxExemptAmount,
    total_taxable_amount: taxSummary.totalTaxableAmount,
    sales_tax_collected: taxSummary.salesTaxCollected,
    tax_rate: taxSummary.taxRate,
    state_tax: taxSummary.stateTax,
    district_tax: taxSummary.districtTax,
    tax_jurisdiction_code: taxSummary.jurisdictionCode,
    jurisdiction_id: taxSummary.jurisdictionId,
    jurisdiction_label: taxSummary.jurisdictionLabel
  });
  if (taxRecErr) {
    console.error("[checkout] order_tax_records insert failed:", taxRecErr.message);
  }

  if (forcePaidTest || !awaitingPayment) {
    // Card (business or retail) / test paid: invoice paid until real Stripe.
    const methodLabel = forcePaidTest
      ? "test_checkout"
      : payByCard
        ? "card"
        : "test_checkout";
    await supabase.from("payments").insert({
      invoice_id: invoice.id,
      payment_kind: "payment",
      status: "succeeded",
      amount: payAmount,
      currency: "USD",
      payment_method: methodLabel,
      provider: payByCard && !forcePaidTest ? "stripe_pending" : "vinameals_test",
      provider_payment_id: `test_${orderId}`,
      reference: order.order_number,
      received_at: now,
      notes: forcePaidTest
        ? "Test checkout — paid in full (not real Stripe)."
        : payByCard
          ? "Business card payment (Stripe later — test paid for now)."
          : "Retail web order (payment method UI not shown; Stripe later).",
      created_by: viewer.id
    });
    await supabase
      .from("sales_orders")
      .update({
        payment_method: methodLabel,
        payment_confirmed_at: now,
        payment_confirmed_by: viewer.id
      })
      .eq("id", orderId);
  } else if (isBusinessOrder && paymentMethod && isOfflinePaymentMethod(paymentMethod)) {
    // Business offline: pending until staff confirms.
    await supabase.from("payments").insert({
      invoice_id: invoice.id,
      payment_kind: "payment",
      status: "pending",
      amount: payAmount,
      currency: "USD",
      payment_method: paymentMethod,
      provider: "offline",
      reference: paymentReference || order.order_number,
      notes: `Customer selected ${paymentMethod}. Awaiting staff confirmation.`,
      created_by: viewer.id
    });
  }

  await writeAuditLog({
    actorUserId: viewer.id,
    action: forcePaidTest
      ? "order.create_paid"
      : isBusinessOrder
        ? "order.create_awaiting_payment"
        : "order.create",
    entityType: "sales_order",
    entityId: orderId,
    after: {
      orderNumber: order.order_number,
      status: "confirmed",
      fulfillmentMethod,
      total: payAmount,
      discountAmount,
      paymentMethod: forcePaidTest ? "test_checkout" : paymentMethod ?? "retail",
      invoiceNumber: invFresh?.invoice_number ?? invoice.invoice_number,
      paid: !awaitingPayment
    },
    metadata: {
      ...actorAuditMeta(viewer),
      orderNumber: order.order_number,
      paymentMethod: forcePaidTest ? "test_checkout" : paymentMethod ?? null,
      isBusinessOrder,
      forcePaidTest,
      discountPercent: discountPercent ?? 0
    }
  });

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
    discountAmount,
    fulfillmentMethod,
    paymentMethod: forcePaidTest ? null : paymentMethod,
    paymentInstructions:
      !forcePaidTest &&
      isBusinessOrder &&
      paymentMethod &&
      isOfflinePaymentMethod(paymentMethod)
        ? PAYMENT_INSTRUCTIONS[paymentMethod]
        : null,
    awaitingPayment,
    isBusinessOrder,
    isTestPaid: forcePaidTest
  };
}
