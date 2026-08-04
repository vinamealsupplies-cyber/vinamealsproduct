/**
 * Lightweight Mobile API Worker — bypasses the oversized Next.js OpenNext bundle.
 * Routes: /api/mobile/v1/*
 * Secrets: SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SERVICE_ROLE_KEY
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type Env = {
  SUPABASE_URL: string;
  SUPABASE_PUBLISHABLE_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
};

type Viewer = {
  id: string;
  email: string;
  fullName: string;
  role: string;
  isStaff: boolean;
  isManager: boolean;
  isAdmin: boolean;
  isSeller: boolean;
  canAccessAdmin: boolean;
};

const PICKUP_CODE = "STORE-PICKUP";
const SHIPPING_FLAT = 12.5;

function json(data: unknown, status = 200) {
  return new Response(
    JSON.stringify({
      data,
      error: null,
      meta: { requestId: crypto.randomUUID(), nextCursor: null }
    }),
    { status, headers: { "content-type": "application/json", "access-control-allow-origin": "*" } }
  );
}

function jsonErr(code: string, message: string, status = 400) {
  return new Response(
    JSON.stringify({
      data: null,
      error: { code, message },
      meta: { requestId: crypto.randomUUID(), nextCursor: null }
    }),
    { status, headers: { "content-type": "application/json", "access-control-allow-origin": "*" } }
  );
}

function admin(env: Env) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}

async function getViewer(req: Request, env: Env): Promise<Viewer | null> {
  const h = req.headers.get("authorization") ?? req.headers.get("Authorization") ?? "";
  if (!h.toLowerCase().startsWith("bearer ")) return null;
  const token = h.slice(7).trim();
  if (!token || token.split(".").length < 3) return null;

  // Prefer service-role client for getUser — more reliable with JWT verification
  // than publishable key alone on Workers.
  const authAdmin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  let userId: string | null = null;
  let userEmail: string | null = null;

  const { data: byService, error: svcErr } = await authAdmin.auth.getUser(token);
  if (!svcErr && byService.user) {
    userId = byService.user.id;
    userEmail = byService.user.email ?? null;
  } else {
    // Fallback: publishable client
    const authPub = createClient(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false }
    });
    const { data: byPub, error: pubErr } = await authPub.auth.getUser(token);
    if (pubErr || !byPub.user) return null;
    userId = byPub.user.id;
    userEmail = byPub.user.email ?? null;
  }
  if (!userId) return null;

  const sb = admin(env);
  const { data: profile } = await sb
    .from("profiles")
    .select("id, email, full_name, role, status")
    .eq("id", userId)
    .maybeSingle();

  // Profile may lag trigger for brand-new OAuth users — create a customer profile
  if (!profile) {
    await sb.from("profiles").upsert({
      id: userId,
      email: userEmail,
      role: "customer",
      status: "active"
    });
    const { data: created } = await sb
      .from("profiles")
      .select("id, email, full_name, role, status")
      .eq("id", userId)
      .maybeSingle();
    if (!created || created.status !== "active") return null;
    return {
      id: created.id,
      email: created.email ?? userEmail ?? "",
      fullName: created.full_name ?? "",
      role: created.role,
      isStaff: false,
      isManager: false,
      isAdmin: false,
      isSeller: false,
      canAccessAdmin: false
    };
  }

  if (profile.status !== "active") return null;

  const role = profile.role as string;
  const isStaff = ["staff", "manager", "admin"].includes(role);
  const isManager = ["manager", "admin"].includes(role);
  const isSeller = role === "seller";
  return {
    id: profile.id,
    email: profile.email ?? userEmail ?? "",
    fullName: profile.full_name ?? "",
    role,
    isStaff,
    isManager,
    isAdmin: role === "admin",
    isSeller,
    canAccessAdmin: isStaff || isSeller
  };
}

function num(v: unknown) {
  const n = typeof v === "string" ? Number.parseFloat(v) : Number(v);
  return Number.isFinite(n) ? n : 0;
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    if (req.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-methods": "GET,POST,PATCH,OPTIONS",
          "access-control-allow-headers": "authorization,content-type"
        }
      });
    }

    const url = new URL(req.url);
    // Accept both full path and worker root
    let path = url.pathname;
    if (!path.startsWith("/api/mobile")) {
      // if hit via workers.dev without prefix, allow /v1/...
      if (path.startsWith("/v1/")) path = "/api/mobile" + path;
    }

    try {
      if (path === "/api/mobile/v1/bootstrap" && req.method === "GET") {
        return handleBootstrap(req, env);
      }
      if (path === "/api/mobile/v1/me" && req.method === "GET") {
        return handleMe(req, env);
      }
      if (path === "/api/mobile/v1/checkout" && req.method === "POST") {
        return handleCheckout(req, env);
      }
      if (path === "/api/mobile/v1/orders" && req.method === "GET") {
        return handleCustomerOrders(req, env);
      }
      if (path.match(/^\/api\/mobile\/v1\/orders\/[^/]+$/) && req.method === "GET") {
        const id = path.split("/")[5];
        return handleCustomerOrderDetail(req, env, id);
      }
      if (path === "/api/mobile/v1/management/dashboard" && req.method === "GET") {
        return handleDashboard(req, env);
      }
      if (path === "/api/mobile/v1/management/orders" && req.method === "GET") {
        return handleStaffOrders(req, env, url);
      }
      if (path.match(/^\/api\/mobile\/v1\/management\/orders\/[^/]+\/actions$/) && req.method === "POST") {
        const id = path.split("/")[6];
        return handleOrderAction(req, env, id);
      }
      if (path.match(/^\/api\/mobile\/v1\/management\/orders\/[^/]+$/) && req.method === "GET") {
        const id = path.split("/")[6];
        return handleStaffOrderDetail(req, env, id);
      }
      if (path === "/api/mobile/v1/management/inventory" && req.method === "GET") {
        return handleInventory(req, env);
      }
      if (path === "/api/mobile/v1/management/inventory/adjust" && req.method === "POST") {
        return handleInventoryAdjust(req, env);
      }
      if (path === "/api/mobile/v1/management/inventory/history" && req.method === "GET") {
        return handleInventoryHistory(req, env, url);
      }
      if (path === "/api/mobile/v1/management/customers" && req.method === "GET") {
        return handleCustomers(req, env, url);
      }
      if (path === "/api/mobile/v1/management/products" && req.method === "GET") {
        return handleProducts(req, env, url);
      }
      if (path === "/api/mobile/v1/management/products" && req.method === "POST") {
        return handleProductCreate(req, env);
      }
      if (path.match(/^\/api\/mobile\/v1\/management\/products\/[^/]+$/) && req.method === "PATCH") {
        const id = path.split("/")[6];
        return handleProductUpdate(req, env, id);
      }
      if (path.match(/^\/api\/mobile\/v1\/management\/products\/[^/]+\/status$/) && req.method === "POST") {
        const id = path.split("/")[6];
        return handleProductStatus(req, env, id);
      }
      if (path === "/api/mobile/v1/management/expenses" && req.method === "GET") {
        return handleExpensesList(req, env);
      }
      if (path === "/api/mobile/v1/management/expenses" && req.method === "POST") {
        return handleExpenseCreate(req, env);
      }
      if (path === "/api/mobile/v1/management/audit-log" && req.method === "GET") {
        return handleAuditLog(req, env);
      }
      if (path === "/api/mobile/v1/management/settings" && req.method === "GET") {
        return handleSettingsGet(req, env);
      }
      if (path === "/api/mobile/v1/management/settings" && req.method === "PATCH") {
        return handleSettingsPatch(req, env);
      }
      if (path === "/api/mobile/v1/management/applications/decide" && req.method === "POST") {
        return handleApplicationDecide(req, env);
      }
      if (path === "/api/mobile/v1/management/invoices" && req.method === "GET") {
        return handleInvoices(req, env);
      }
      if (path === "/api/mobile/v1/management/categories" && req.method === "GET") {
        return handleCategories(req, env);
      }
      if (path === "/api/mobile/v1/management/accounts" && req.method === "GET") {
        return handleAccounts(req, env);
      }
      if (path.match(/^\/api\/mobile\/v1\/management\/accounts\/[^/]+$/) && req.method === "PATCH") {
        const id = path.split("/")[6];
        return handleAccountPatch(req, env, id);
      }
      if (path === "/api/mobile/v1/management/reports/summary" && req.method === "GET") {
        return handleReports(req, env);
      }
      if (path === "/api/mobile/v1/management/applications" && req.method === "GET") {
        return handleApplications(req, env);
      }
      if (path === "/api/mobile/v1/addresses" && req.method === "GET") {
        return handleAddressesGet(req, env);
      }
      if (path === "/api/mobile/v1/addresses" && req.method === "POST") {
        return handleAddressesPost(req, env);
      }
      if (path === "/api/mobile/v1/me" && req.method === "PATCH") {
        return handleMePatch(req, env);
      }

      return jsonErr("NOT_FOUND", `No route ${req.method} ${path}`, 404);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Server error";
      return jsonErr("INTERNAL", msg, 500);
    }
  }
};

async function handleBootstrap(req: Request, env: Env) {
  const viewer = await getViewer(req, env);
  const sb = admin(env);
  const { data: categories } = await sb
    .from("categories")
    .select("id, name, slug, is_active")
    .eq("is_active", true)
    .order("name");
  return json({
    storeName: "Vinameals",
    siteOrigin: "https://vinamealsupplies.com",
    categories: (categories ?? []).map((c) => ({ id: c.id, name: c.name, slug: c.slug })),
    viewer: viewer
      ? {
          id: viewer.id,
          email: viewer.email,
          fullName: viewer.fullName,
          role: viewer.role,
          canAccessManagement: viewer.canAccessAdmin
        }
      : null,
    features: { googleOAuth: true, checkout: true, management: true, forcePaidTestCheckout: true }
  });
}

async function handleMe(req: Request, env: Env) {
  const v = await getViewer(req, env);
  if (!v) return jsonErr("UNAUTHORIZED", "Sign in required.", 401);
  return json({
    id: v.id,
    email: v.email,
    fullName: v.fullName,
    role: v.role,
    isStaff: v.isStaff,
    isManager: v.isManager,
    isAdmin: v.isAdmin,
    isSeller: v.isSeller,
    canAccessManagement: v.canAccessAdmin
  });
}

async function handleMePatch(req: Request, env: Env) {
  const v = await getViewer(req, env);
  if (!v) return jsonErr("UNAUTHORIZED", "Sign in required.", 401);
  const body = (await req.json()) as { fullName?: string; phone?: string };
  const patch: Record<string, string> = {};
  if (body.fullName != null) patch.full_name = String(body.fullName).trim().slice(0, 120);
  if (body.phone != null) patch.phone = String(body.phone).trim().slice(0, 40);
  if (!Object.keys(patch).length) return jsonErr("BAD_REQUEST", "Nothing to update.");
  const sb = admin(env);
  await sb.from("profiles").update(patch).eq("id", v.id);
  return json({ ok: true, ...patch });
}

async function handleCheckout(req: Request, env: Env) {
  const viewer = await getViewer(req, env);
  if (!viewer) return jsonErr("UNAUTHORIZED", "Sign in required.", 401);

  const body = (await req.json()) as {
    items?: { productId: string; quantity: number; note?: string }[];
    fulfillmentMethod?: "pickup" | "ship";
    shippingAddressId?: string | null;
    phone?: string | null;
    deliveryNote?: string | null;
    forcePaidTest?: boolean;
  };

  const items = body.items ?? [];
  if (!items.length) return jsonErr("EMPTY_CART", "Cart is empty.");

  const fulfillment: "pickup" | "ship" = body.fulfillmentMethod === "ship" ? "ship" : "pickup";
  const forcePaid = body.forcePaidTest !== false;
  const sb = admin(env);

  // Aggregate cart (+ optional line notes / special requests)
  const wanted = new Map<string, { quantity: number; notes: string[] }>();
  for (const it of items) {
    const id = String(it.productId ?? "").trim();
    const q = Math.floor(Number(it.quantity));
    if (!id || q <= 0) continue;
    const note = String(it.note ?? "").trim().slice(0, 300);
    const cur = wanted.get(id) ?? { quantity: 0, notes: [] as string[] };
    cur.quantity += q;
    if (note && !cur.notes.includes(note)) cur.notes.push(note);
    wanted.set(id, cur);
  }
  if (!wanted.size) return jsonErr("INVALID_CART", "Invalid cart.");

  const { data: productRows, error: prodErr } = await sb
    .from("products")
    .select(
      "id, name, status, product_variants ( id, sku, retail_price, sale_price, cost_price, is_default, is_active )"
    )
    .in("id", [...wanted.keys()]);
  if (prodErr) return jsonErr("LOAD_FAILED", "Could not load products.");

  type V = {
    id: string;
    sku: string;
    retail_price: number;
    sale_price: number | null;
    cost_price: number;
    is_default: boolean;
    is_active: boolean;
  };
  type P = { id: string; name: string; status: string; product_variants: V[] | null };

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

  for (const row of (productRows ?? []) as P[]) {
    if (row.status !== "active") continue;
    const line = wanted.get(row.id);
    if (!line) continue;
    const variants = row.product_variants ?? [];
    const variant = variants.find((x) => x.is_default) ?? variants.find((x) => x.is_active) ?? variants[0];
    if (!variant) continue;
    const retail = num(variant.retail_price);
    const sale = variant.sale_price == null ? null : num(variant.sale_price);
    const unit = sale != null && sale >= 0 && sale < retail ? sale : retail;
    orderItems.push({
      product_id: row.id,
      variant_id: variant.id,
      product_name_snapshot: row.name,
      sku_snapshot: variant.sku ?? "",
      quantity: line.quantity,
      unit_price: unit,
      unit_cost_snapshot: num(variant.cost_price),
      line_note: line.notes.length ? line.notes.join("; ").slice(0, 300) : null,
      discount_amount: 0,
      tax_amount: 0,
      tax_rate_snapshot: 0
    });
  }
  if (!orderItems.length) return jsonErr("INVALID_CART", "No valid products in the cart.");

  const subtotal = orderItems.reduce((s, i) => s + i.unit_price * i.quantity, 0);

  const { data: profile } = await sb
    .from("profiles")
    .select("full_name, phone, email")
    .eq("id", viewer.id)
    .maybeSingle();

  let phone = (profile?.phone ?? "").trim() || null;
  if (!phone) {
    const entered = String(body.phone ?? "").trim();
    if (!entered) {
      return jsonErr(
        "PHONE_REQUIRED",
        "Please enter a phone number so we can reach you about this order."
      );
    }
    phone = entered.slice(0, 40);
    await sb.from("profiles").update({ phone }).eq("id", viewer.id);
  }

  const fullName = (profile?.full_name ?? viewer.fullName ?? "").trim();
  const parts = fullName ? fullName.split(/\s+/) : [];
  const firstName = parts[0] || null;
  const lastName = parts.length > 1 ? parts.slice(1).join(" ") : null;

  let customerId: string | null = null;
  const { data: existingCustomer } = await sb
    .from("customers")
    .select("id, first_name, last_name, phone")
    .eq("auth_user_id", viewer.id)
    .maybeSingle();
  customerId = existingCustomer?.id ?? null;

  if (!customerId) {
    const { data: created, error: cErr } = await sb
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
    if (cErr) return jsonErr("CUSTOMER_FAILED", cErr.message);
    customerId = created?.id ?? null;
  } else {
    const patch: Record<string, string> = {};
    if (!existingCustomer?.phone && phone) patch.phone = phone;
    if (!existingCustomer?.first_name && firstName) patch.first_name = firstName;
    if (Object.keys(patch).length) await sb.from("customers").update(patch).eq("id", customerId);
  }
  if (!customerId) return jsonErr("CUSTOMER_FAILED", "Could not create customer.");

  let pickupLocationId: string | null = null;
  let shippingAmount = 0;
  let shippingSnapshot: Record<string, unknown> | null = null;

  if (fulfillment === "pickup") {
    const { data: loc } = await sb
      .from("inventory_locations")
      .select("id")
      .eq("code", PICKUP_CODE)
      .maybeSingle();
    if (!loc?.id) return jsonErr("CONFIG", "Pickup location STORE-PICKUP is not configured.");
    pickupLocationId = loc.id;
  } else {
    const addrId = body.shippingAddressId?.trim();
    if (!addrId) return jsonErr("ADDRESS_REQUIRED", "Select a shipping address for delivery.");
    const { data: address } = await sb
      .from("customer_addresses")
      .select(
        "id, customer_id, recipient_name, company_name, phone, note, line1, line2, city, state_region, postal_code, country_code"
      )
      .eq("id", addrId)
      .eq("customer_id", customerId)
      .maybeSingle();
    if (!address) return jsonErr("ADDRESS_INVALID", "Invalid shipping address.");
    shippingAmount = SHIPPING_FLAT;
    const note = String(body.deliveryNote ?? "").trim().slice(0, 500);
    shippingSnapshot = {
      recipient_name: address.recipient_name,
      company_name: address.company_name,
      phone: address.phone,
      note: note || address.note || null,
      line1: address.line1,
      line2: address.line2,
      city: address.city,
      state_region: address.state_region,
      postal_code: address.postal_code,
      country_code: address.country_code
    };
  }

  // Mobile MVP: tax deferred (0) — staff can adjust; matches earlier "Calculated at checkout" phase
  const taxAmount = 0;
  const discountAmount = 0;
  const total = Math.max(0, subtotal - discountAmount + shippingAmount + taxAmount);
  const now = new Date().toISOString();

  const { data: order, error: orderErr } = await sb
    .from("sales_orders")
    .insert({
      customer_id: customerId,
      channel: "web",
      status: "confirmed",
      currency: "USD",
      fulfillment_method: fulfillment,
      pickup_location_id: pickupLocationId,
      shipping_amount: shippingAmount,
      shipping_address_snapshot: shippingSnapshot,
      subtotal,
      discount_amount: discountAmount,
      tax_amount: taxAmount,
      total_amount: total,
      payment_method: forcePaid ? "test_checkout" : null,
      notes: `Mobile app order (${fulfillment}).${forcePaid ? " Test paid checkout." : ""}`,
      placed_at: now,
      created_by: viewer.id
    })
    .select("id, order_number, total_amount")
    .single();

  if (orderErr || !order) {
    return jsonErr("ORDER_FAILED", orderErr?.message ?? "Could not create order.");
  }

  const itemRows = orderItems.map((i) => ({ ...i, order_id: order.id }));
  const { error: itemsErr } = await sb.from("sales_order_items").insert(itemRows);
  if (itemsErr) {
    await sb.from("sales_orders").delete().eq("id", order.id);
    return jsonErr("ORDER_ITEMS_FAILED", itemsErr.message);
  }

  // Invoice + optional paid payment for test path
  // Schema: invoices.order_id (not sales_order_id); balance_due is generated.
  let invoiceNumber: string | null = null;
  if (total > 0) {
    const { data: inv, error: invErr } = await sb
      .from("invoices")
      .insert({
        customer_id: customerId,
        order_id: order.id,
        status: forcePaid ? "paid" : "issued",
        issue_date: now.slice(0, 10),
        currency: "USD",
        subtotal,
        discount_amount: discountAmount,
        tax_amount: taxAmount,
        shipping_amount: shippingAmount,
        total_amount: total,
        amount_paid: forcePaid ? total : 0,
        created_by: viewer.id,
        issued_at: now
      })
      .select("id, invoice_number")
      .single();

    if (!invErr && inv) {
      invoiceNumber = inv.invoice_number;
      if (forcePaid) {
        await sb.from("payments").insert({
          invoice_id: inv.id,
          amount: total,
          currency: "USD",
          status: "succeeded",
          payment_method: "test_checkout",
          received_at: now,
          created_by: viewer.id
        });
      }
    }
  }

  // Clear server cart if any
  await sb.from("cart_items").delete().eq("user_id", viewer.id);

  return json(
    {
      ok: true,
      orderNumber: order.order_number,
      invoiceNumber,
      total: num(order.total_amount),
      fulfillmentMethod: fulfillment,
      awaitingPayment: !forcePaid,
      isBusinessOrder: false
    },
    201
  );
}

/** Customer-facing status copy — mirrors lib/data/customer-orders.ts statusCopy() */
function customerStatusCopy(o: {
  status: string;
  fulfillmentMethod: string;
  pickupReadyAt: string | null;
  pickedUpAt: string | null;
}) {
  if (o.status === "cancelled") {
    return { label: "Cancelled", detail: "This order was cancelled.", isOpen: false };
  }
  if (o.status === "fulfilled") {
    return {
      label: "Completed",
      detail: o.fulfillmentMethod === "pickup" ? "Picked up / completed." : "Delivered / completed.",
      isOpen: false
    };
  }
  if (o.status === "confirmed") {
    if (o.fulfillmentMethod === "pickup") {
      if (o.pickupReadyAt) {
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
    return {
      label: "In progress",
      detail: "Your order is being prepared or shipped.",
      isOpen: true
    };
  }
  return { label: "Draft", detail: "Not submitted yet.", isOpen: false };
}

function mapCustomerPayment(row: {
  status: string;
  total_amount: unknown;
  invoices?:
    | {
        amount_paid?: unknown;
        total_amount?: unknown;
        status?: string;
        payments?:
          | { received_at?: string | null; status?: string; amount?: unknown; payment_method?: string | null; created_at?: string }[]
          | { received_at?: string | null; status?: string; amount?: unknown; payment_method?: string | null; created_at?: string }
          | null;
      }[]
    | {
        amount_paid?: unknown;
        total_amount?: unknown;
        status?: string;
        payments?: unknown;
      }
    | null;
}) {
  const invoices = Array.isArray(row.invoices) ? row.invoices : row.invoices ? [row.invoices] : [];
  const payments = invoices.flatMap((inv) => {
    const p = inv.payments;
    if (!p) return [];
    return Array.isArray(p) ? p : [p];
  }) as {
    received_at?: string | null;
    status?: string;
    amount?: unknown;
    payment_method?: string | null;
    created_at?: string;
  }[];

  const succeeded = payments
    .filter((p) => p.status === "succeeded")
    .sort((a, b) => {
      const ta = new Date(a.received_at ?? a.created_at ?? 0).getTime();
      const tb = new Date(b.received_at ?? b.created_at ?? 0).getTime();
      return tb - ta;
    });

  if (succeeded.length) {
    const latest = succeeded[0];
    return {
      paidAt: latest.received_at ?? latest.created_at ?? null,
      paymentMethod: latest.payment_method ?? null,
      paymentStatus: "paid" as const
    };
  }
  const amountPaid = invoices.reduce((sum, inv) => sum + num(inv.amount_paid), 0);
  if (amountPaid > 0 && amountPaid < num(row.total_amount)) {
    return { paidAt: null, paymentMethod: null, paymentStatus: "partial" as const };
  }
  if (payments.some((p) => p.status === "pending")) {
    return { paidAt: null, paymentMethod: null, paymentStatus: "pending" as const };
  }
  if (row.status === "confirmed" || row.status === "fulfilled") {
    return { paidAt: null, paymentMethod: null, paymentStatus: "pending" as const };
  }
  return { paidAt: null, paymentMethod: null, paymentStatus: "none" as const };
}

async function handleCustomerOrders(req: Request, env: Env) {
  const v = await getViewer(req, env);
  if (!v) return jsonErr("UNAUTHORIZED", "Sign in required.", 401);
  const sb = admin(env);
  const { data: cust } = await sb.from("customers").select("id").eq("auth_user_id", v.id).maybeSingle();
  if (!cust) return json({ orders: [] });

  const { data: orders, error } = await sb
    .from("sales_orders")
    .select(
      `id, order_number, status, fulfillment_method, total_amount, subtotal, tax_amount, shipping_amount, discount_amount, currency, placed_at, created_at, notes, pickup_ready_at, picked_up_at, fulfilled_at, tracking_number, shipping_carrier, tracking_url,
       items:sales_order_items ( id, product_name_snapshot, variant_name_snapshot, sku_snapshot, quantity, unit_price, line_total, line_note ),
       invoices ( id, amount_paid, total_amount, status, invoice_number, payments ( received_at, status, amount, payment_method, created_at ) )`
    )
    .eq("customer_id", cust.id)
    .neq("status", "draft")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) return jsonErr("LOAD_FAILED", error.message);

  type Item = {
    id: string;
    product_name_snapshot: string;
    variant_name_snapshot: string | null;
    sku_snapshot: string;
    quantity: unknown;
    unit_price: unknown;
    line_total?: unknown;
    line_note: string | null;
  };

  const mapped = (orders ?? []).map((o) => {
    const items = ((o.items as Item[] | null) ?? []).map((item) => {
      const quantity = num(item.quantity);
      const unitPrice = num(item.unit_price);
      return {
        id: item.id,
        productName: item.product_name_snapshot,
        variantName: item.variant_name_snapshot,
        sku: item.sku_snapshot,
        quantity,
        unitPrice,
        lineTotal: item.line_total != null ? num(item.line_total) : quantity * unitPrice,
        lineNote: item.line_note?.trim() || null
      };
    });
    const fulfillmentMethod = o.fulfillment_method ?? "pickup";
    const copy = customerStatusCopy({
      status: o.status,
      fulfillmentMethod,
      pickupReadyAt: o.pickup_ready_at ?? null,
      pickedUpAt: o.picked_up_at ?? null
    });
    const payment = mapCustomerPayment(o as Parameters<typeof mapCustomerPayment>[0]);
    const inv = Array.isArray(o.invoices) ? o.invoices[0] : o.invoices;

    return {
      id: o.id,
      number: o.order_number ?? o.id.slice(0, 8),
      status: o.status,
      fulfillmentMethod,
      total: num(o.total_amount),
      subtotal: num(o.subtotal),
      tax: num(o.tax_amount),
      shipping: num(o.shipping_amount),
      discount: num(o.discount_amount),
      currency: o.currency ?? "USD",
      placedAt: o.placed_at ?? o.created_at,
      createdAt: o.created_at,
      notes: o.notes,
      pickupReadyAt: o.pickup_ready_at,
      pickedUpAt: o.picked_up_at,
      fulfilledAt: o.fulfilled_at,
      trackingNumber: o.tracking_number,
      shippingCarrier: o.shipping_carrier,
      trackingUrl: o.tracking_url,
      paidAt: payment.paidAt,
      paymentMethod: payment.paymentMethod,
      paymentStatus: payment.paymentStatus,
      invoiceNumber: inv && typeof inv === "object" && "invoice_number" in inv ? (inv as { invoice_number?: string }).invoice_number ?? null : null,
      itemCount: items.length,
      items,
      isOpen: copy.isOpen,
      statusLabel: copy.label,
      statusDetail: copy.detail
    };
  });

  return json({ orders: mapped });
}

async function requireAdmin(req: Request, env: Env) {
  const v = await getViewer(req, env);
  if (!v) return { error: jsonErr("UNAUTHORIZED", "Sign in required.", 401) as Response };
  if (!v.canAccessAdmin) return { error: jsonErr("FORBIDDEN", "Management access required.", 403) as Response };
  return { viewer: v };
}

async function handleDashboard(req: Request, env: Env) {
  const gate = await requireAdmin(req, env);
  if ("error" in gate && gate.error) return gate.error;
  const sb = admin(env);
  const { data: orders } = await sb
    .from("sales_orders")
    .select("id, status, fulfillment_method, total_amount, created_at, pickup_ready_at, picked_up_at")
    .in("status", ["confirmed", "fulfilled", "cancelled"])
    .order("created_at", { ascending: false })
    .limit(200);

  const list = orders ?? [];
  const open = list.filter((o) => o.status === "confirmed");
  const awaiting = open.filter(
    (o) => o.fulfillment_method === "pickup" && o.pickup_ready_at && !o.picked_up_at
  );
  const today = new Date().toISOString().slice(0, 10);
  const todayOrders = list.filter((o) => (o.created_at ?? "").startsWith(today));

  const { data: inv } = await sb.from("invoices").select("balance_due").gt("balance_due", 0).limit(200);
  const unpaid = inv ?? [];
  const outstanding = unpaid.reduce((s, i) => s + num(i.balance_due), 0);

  const { count: lowStock } = await sb
    .from("v_inventory_detail")
    .select("*", { count: "exact", head: true })
    .neq("stock_status", "in_stock");

  return json({
    awaitingPickup: awaiting.length,
    openOrders: open.length,
    unpaidInvoices: unpaid.length,
    lowStockSkus: lowStock ?? 0,
    todayOrderCount: todayOrders.length,
    todayOrderTotal: todayOrders.reduce((s, o) => s + num(o.total_amount), 0),
    outstandingBalance: outstanding
  });
}

async function handleStaffOrders(req: Request, env: Env, url: URL) {
  const gate = await requireAdmin(req, env);
  if ("error" in gate && gate.error) return gate.error;
  const filter = url.searchParams.get("filter");
  const sb = admin(env);
  const { data: orders } = await sb
    .from("sales_orders")
    .select(
      `id, order_number, status, fulfillment_method, total_amount, currency, created_at, notes,
       pickup_ready_at, picked_up_at, fulfilled_at, tracking_number, shipping_carrier,
       customers ( first_name, last_name, company_name, phone )`
    )
    .order("created_at", { ascending: false })
    .limit(100);

  type Row = {
    id: string;
    order_number: string | null;
    status: string;
    fulfillment_method: string;
    total_amount: number;
    currency: string;
    created_at: string;
    notes: string | null;
    pickup_ready_at: string | null;
    picked_up_at: string | null;
    fulfilled_at: string | null;
    tracking_number: string | null;
    shipping_carrier: string | null;
    customers: {
      first_name: string | null;
      last_name: string | null;
      company_name: string | null;
      phone: string | null;
    } | null;
  };

  let mapped = ((orders ?? []) as Row[]).map((o) => {
    const c = o.customers;
    const name = [c?.first_name, c?.last_name].filter(Boolean).join(" ") || c?.company_name || "Customer";
    const awaitingPickup =
      o.status === "confirmed" &&
      o.fulfillment_method === "pickup" &&
      Boolean(o.pickup_ready_at) &&
      !o.picked_up_at;
    const awaitingPickupPrep =
      o.status === "confirmed" && o.fulfillment_method === "pickup" && !o.pickup_ready_at;
    const awaitingDelivery =
      o.status === "confirmed" && o.fulfillment_method === "ship" && !o.fulfilled_at;
    const statusLabel =
      o.status === "cancelled"
        ? "Cancelled"
        : o.status === "fulfilled"
          ? o.fulfillment_method === "pickup"
            ? "Picked up"
            : "Shipped / delivered"
          : awaitingPickup
            ? "Ready for pickup"
            : awaitingPickupPrep
              ? "Preparing"
              : awaitingDelivery
                ? "Awaiting ship"
                : o.status === "confirmed"
                  ? "Confirmed"
                  : o.status;
    return {
      id: o.id,
      number: o.order_number ?? o.id.slice(0, 8),
      customer: name,
      customerCompany: c?.company_name ?? null,
      customerPhone: c?.phone ?? null,
      status: o.status,
      statusLabel,
      fulfillmentMethod: o.fulfillment_method,
      total: num(o.total_amount),
      currency: o.currency ?? "USD",
      createdAt: o.created_at,
      notes: o.notes,
      awaitingPickup,
      awaitingPickupPrep,
      awaitingDelivery,
      canMarkPickupReady: awaitingPickupPrep,
      canConfirmPickedUp: awaitingPickup,
      canCancel: o.status === "confirmed",
      canConfirmPayment: false,
      canEditTracking: o.fulfillment_method === "ship" && o.status === "confirmed",
      paymentStatus: "none",
      trackingNumber: o.tracking_number,
      shippingCarrier: o.shipping_carrier,
      itemCount: 0
    };
  });

  if (filter === "open") mapped = mapped.filter((o) => o.status === "confirmed");
  if (filter === "awaiting") {
    mapped = mapped.filter((o) => o.awaitingPickup || o.awaitingPickupPrep || o.awaitingDelivery);
  }
  return json({ orders: mapped });
}

async function handleOrderAction(req: Request, env: Env, orderId: string) {
  const gate = await requireAdmin(req, env);
  if ("error" in gate && gate.error) return gate.error;
  const viewer = gate.viewer!;
  const body = (await req.json()) as {
    action?: string;
    note?: string;
    reason?: string;
    carrier?: string;
    trackingNumber?: string;
  };
  const action = body.action ?? "";
  const sb = admin(env);
  const now = new Date().toISOString();

  const { data: order } = await sb
    .from("sales_orders")
    .select("id, status, fulfillment_method, pickup_ready_at, picked_up_at")
    .eq("id", orderId)
    .maybeSingle();
  if (!order) return jsonErr("NOT_FOUND", "Order not found.", 404);

  if (action === "mark_pickup_ready") {
    await sb
      .from("sales_orders")
      .update({ pickup_ready_at: now, updated_at: now })
      .eq("id", orderId);
  } else if (action === "confirm_pickup") {
    await sb
      .from("sales_orders")
      .update({
        picked_up_at: now,
        status: "fulfilled",
        fulfilled_at: now,
        picked_up_by: viewer.id,
        picked_up_by_name: viewer.fullName || viewer.email,
        updated_at: now
      })
      .eq("id", orderId);
  } else if (action === "cancel") {
    await sb
      .from("sales_orders")
      .update({
        status: "cancelled",
        cancel_note: (body.reason ?? body.note ?? "Cancelled").slice(0, 500),
        cancelled_by_name: viewer.fullName || viewer.email,
        cancelled_at: now,
        updated_at: now
      })
      .eq("id", orderId);
  } else if (action === "confirm_delivered" || action === "save_tracking") {
    const tracking = (body.trackingNumber ?? "").trim();
    const carrier = (body.carrier ?? "other").trim().toLowerCase();
    const patch: Record<string, unknown> = {
      shipping_carrier: carrier,
      updated_at: now
    };
    if (tracking) {
      patch.tracking_number = tracking;
      patch.shipped_at = now;
    }
    if (action === "confirm_delivered" || body.note === "ship") {
      patch.status = "fulfilled";
      patch.fulfilled_at = now;
    }
    await sb.from("sales_orders").update(patch).eq("id", orderId);
  } else if (action === "update_notes") {
    await sb
      .from("sales_orders")
      .update({ notes: (body.note ?? "").slice(0, 1000), updated_at: now })
      .eq("id", orderId);
  } else if (action === "confirm_payment") {
    // best-effort: mark related invoice paid
    const { data: inv } = await sb
      .from("invoices")
      .select("id, total_amount, amount_paid, balance_due")
      .eq("order_id", orderId)
      .maybeSingle();
    if (inv && num(inv.balance_due) > 0) {
      await sb.from("payments").insert({
        invoice_id: inv.id,
        amount: num(inv.balance_due),
        currency: "USD",
        status: "succeeded",
        payment_method: "offline",
        received_at: now,
        created_by: viewer.id
      });
      await sb
        .from("invoices")
        .update({
          status: "paid",
          amount_paid: num(inv.total_amount)
        })
        .eq("id", inv.id);
    }
  } else {
    return jsonErr("BAD_REQUEST", `Unknown action: ${action}`);
  }

  return json({ ok: true, action });
}

async function handleInventory(req: Request, env: Env) {
  const gate = await requireAdmin(req, env);
  if ("error" in gate && gate.error) return gate.error;
  const viewer = gate.viewer!;
  const sb = admin(env);
  const { data, error } = await sb
    .from("v_inventory_detail")
    .select(
      "variant_id, location_id, product_name, variant_name, sku, location_code, quantity_on_hand, quantity_reserved, available_quantity, cost_price, retail_price, stock_status, product_status"
    )
    .order("product_name")
    .limit(300);
  if (error) return jsonErr("LOAD_FAILED", error.message);
  const items = (data ?? []).map((r) => {
    const row: Record<string, unknown> = {
      variantId: r.variant_id,
      locationId: r.location_id,
      productName: r.product_name,
      variantName: r.variant_name,
      sku: r.sku,
      locationCode: r.location_code,
      onHand: num(r.quantity_on_hand),
      reserved: num(r.quantity_reserved),
      available: num(r.available_quantity),
      retailPrice: num(r.retail_price),
      stockStatus: r.stock_status,
      productStatus: r.product_status
    };
    if (!viewer.isSeller) {
      row.costPrice = num(r.cost_price);
      row.inventoryValue = num(r.quantity_on_hand) * num(r.cost_price);
    }
    return row;
  });
  return json({ items, canSeeUnitCost: !viewer.isSeller });
}

async function handleInventoryAdjust(req: Request, env: Env) {
  const gate = await requireAdmin(req, env);
  if ("error" in gate && gate.error) return gate.error;
  const viewer = gate.viewer!;
  const body = (await req.json()) as {
    variantId?: string;
    locationId?: string;
    sku?: string;
    reason?: string;
    mode?: string;
    quantity?: number;
    currentOnHand?: number;
  };
  const variantId = body.variantId ?? "";
  const locationId = body.locationId ?? "";
  const reason = (body.reason ?? "").trim();
  if (!variantId || !locationId) return jsonErr("BAD_REQUEST", "Missing inventory row.");
  if (!reason) return jsonErr("BAD_REQUEST", "A reason is required.");
  const value = Number(body.quantity);
  if (!Number.isFinite(value)) return jsonErr("BAD_REQUEST", "Enter a number.");
  const current = num(body.currentOnHand);
  const delta = body.mode === "set" ? value - current : value;
  if (delta === 0) return jsonErr("BAD_REQUEST", "That would not change the quantity.");

  const sb = admin(env);
  const { error } = await sb.from("inventory_movements").insert({
    variant_id: variantId,
    location_id: locationId,
    movement_type: "adjustment",
    quantity_change: delta,
    reason,
    created_by: viewer.id
  });
  if (error) return jsonErr("ADJUST_FAILED", error.message);
  const sign = delta > 0 ? "+" : "";
  return json({ message: `Adjusted ${body.sku || "item"} by ${sign}${delta}.` });
}

async function handleInventoryHistory(req: Request, env: Env, url: URL) {
  const gate = await requireAdmin(req, env);
  if ("error" in gate && gate.error) return gate.error;
  const variantId = url.searchParams.get("variantId") ?? "";
  const locationId = url.searchParams.get("locationId") ?? "";
  if (!variantId || !locationId) return jsonErr("BAD_REQUEST", "Missing ids.");
  const sb = admin(env);
  const { data, error } = await sb
    .from("inventory_movements")
    .select("id, created_at, movement_type, quantity_change, reason")
    .eq("variant_id", variantId)
    .eq("location_id", locationId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) return jsonErr("LOAD_FAILED", error.message);
  return json({
    movements: (data ?? []).map((m) => ({
      id: m.id,
      createdAt: m.created_at,
      movementType: m.movement_type,
      quantityChange: num(m.quantity_change),
      reason: m.reason,
      sku: "",
      productName: "",
      changedBy: ""
    }))
  });
}

async function handleCustomers(req: Request, env: Env, url: URL) {
  const gate = await requireAdmin(req, env);
  if ("error" in gate && gate.error) return gate.error;
  const q = (url.searchParams.get("q") ?? "").toLowerCase();
  const sb = admin(env);
  const { data, error } = await sb
    .from("customers")
    .select(
      "id, first_name, last_name, company_name, email, phone, customer_type, status, notes, created_at"
    )
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) return jsonErr("LOAD_FAILED", error.message);
  let customers = (data ?? []).map((c) => ({
    id: c.id,
    firstName: c.first_name,
    lastName: c.last_name,
    companyName: c.company_name,
    email: c.email,
    phone: c.phone,
    customerType: c.customer_type,
    status: c.status,
    notes: c.notes
  }));
  if (q) {
    customers = customers.filter((c) =>
      [c.firstName, c.lastName, c.email, c.phone, c.companyName]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }
  return json({ customers });
}

async function handleProducts(req: Request, env: Env, url: URL) {
  const gate = await requireAdmin(req, env);
  if ("error" in gate && gate.error) return gate.error;
  const status = url.searchParams.get("status") ?? "all";
  const sb = admin(env);
  let query = sb
    .from("products")
    .select(
      "id, slug, name, status, featured, short_description, product_variants ( sku, barcode, retail_price, sale_price, cost_price, is_default )"
    )
    .order("name")
    .limit(150);
  if (status !== "all") query = query.eq("status", status);
  const { data, error } = await query;
  if (error) return jsonErr("LOAD_FAILED", error.message);
  const viewer = gate.viewer!;
  const products = (data ?? []).map((p) => {
    const variants = (p.product_variants as { sku: string; barcode: string | null; retail_price: number; sale_price: number | null; cost_price: number; is_default: boolean }[] | null) ?? [];
    const v = variants.find((x) => x.is_default) ?? variants[0];
    const row: Record<string, unknown> = {
      id: p.id,
      slug: p.slug,
      name: p.name,
      status: p.status,
      featured: p.featured,
      sku: v?.sku ?? null,
      barcode: v?.barcode ?? null,
      retailPrice: v ? num(v.retail_price) : null,
      salePrice: v?.sale_price != null ? num(v.sale_price) : null
    };
    if (!viewer.isSeller && v) row.costPrice = num(v.cost_price);
    return row;
  });
  return json({ products });
}

async function handleProductStatus(req: Request, env: Env, id: string) {
  const gate = await requireAdmin(req, env);
  if ("error" in gate && gate.error) return gate.error;
  const body = (await req.json()) as { action?: string };
  const action = body.action ?? "";
  const sb = admin(env);
  if (action === "archive") {
    await sb.from("products").update({ status: "archived", featured: false }).eq("id", id);
    return json({ message: "Archived." });
  }
  if (action === "restore") {
    await sb
      .from("products")
      .update({ status: "active", published_at: new Date().toISOString() })
      .eq("id", id);
    return json({ message: "Restored." });
  }
  if (action === "delete_forever") {
    if (!gate.viewer!.isAdmin) return jsonErr("FORBIDDEN", "Admin only.", 403);
    const { error } = await sb.rpc("admin_delete_product_forever", { p_product_id: id });
    if (error) return jsonErr("DELETE_FAILED", error.message);
    return json({ message: "Deleted forever." });
  }
  return jsonErr("BAD_REQUEST", `Unknown action: ${action}`);
}

async function handleInvoices(req: Request, env: Env) {
  const gate = await requireAdmin(req, env);
  if ("error" in gate && gate.error) return gate.error;
  const sb = admin(env);
  const { data, error } = await sb
    .from("invoices")
    .select(
      "id, invoice_number, issue_date, total_amount, amount_paid, balance_due, status, customers ( company_name, first_name, last_name )"
    )
    .order("issue_date", { ascending: false })
    .limit(100);
  if (error) return jsonErr("LOAD_FAILED", error.message);
  return json({
    invoices: (data ?? []).map((i) => {
      const c = i.customers as {
        company_name: string | null;
        first_name: string | null;
        last_name: string | null;
      } | null;
      const customer =
        c?.company_name ||
        [c?.first_name, c?.last_name].filter(Boolean).join(" ") ||
        "Customer";
      return {
        id: i.id,
        number: i.invoice_number,
        customer,
        issueDate: i.issue_date,
        total: num(i.total_amount),
        paid: num(i.amount_paid),
        balanceDue: num(i.balance_due),
        status: i.status
      };
    })
  });
}

async function handleCategories(req: Request, env: Env) {
  const gate = await requireAdmin(req, env);
  if ("error" in gate && gate.error) return gate.error;
  if (!gate.viewer!.isStaff && !gate.viewer!.isSeller) {
    // sellers can still list for ops
  }
  const sb = admin(env);
  const { data } = await sb
    .from("categories")
    .select("id, parent_id, name, slug, sort_order, is_active, tax_category")
    .order("sort_order");
  return json({
    categories: (data ?? []).map((c) => ({
      id: c.id,
      parentId: c.parent_id,
      name: c.name,
      slug: c.slug,
      sortOrder: c.sort_order,
      isActive: c.is_active,
      taxCategory: c.tax_category
    }))
  });
}

async function handleAccounts(req: Request, env: Env) {
  const v = await getViewer(req, env);
  if (!v) return jsonErr("UNAUTHORIZED", "Sign in required.", 401);
  if (!v.isAdmin) return jsonErr("FORBIDDEN", "Admin only.", 403);
  const sb = admin(env);
  const { data } = await sb
    .from("profiles")
    .select("id, email, full_name, phone, role, status, created_at, updated_at")
    .order("created_at", { ascending: false })
    .limit(200);
  return json({
    accounts: (data ?? []).map((p) => ({
      id: p.id,
      email: p.email,
      fullName: p.full_name,
      phone: p.phone,
      role: p.role,
      status: p.status,
      createdAt: p.created_at,
      updatedAt: p.updated_at
    }))
  });
}

async function handleAccountPatch(req: Request, env: Env, id: string) {
  const v = await getViewer(req, env);
  if (!v) return jsonErr("UNAUTHORIZED", "Sign in required.", 401);
  if (!v.isAdmin) return jsonErr("FORBIDDEN", "Admin only.", 403);
  const body = (await req.json()) as { role?: string; status?: string };
  const patch: Record<string, string> = { updated_at: new Date().toISOString() };
  if (body.role) patch.role = body.role;
  if (body.status) patch.status = body.status;
  const sb = admin(env);
  const { data, error } = await sb
    .from("profiles")
    .update(patch)
    .eq("id", id)
    .select("id, email, full_name, phone, role, status, created_at, updated_at")
    .maybeSingle();
  if (error) return jsonErr("UPDATE_FAILED", error.message);
  return json({
    account: data
      ? {
          id: data.id,
          email: data.email,
          fullName: data.full_name,
          phone: data.phone,
          role: data.role,
          status: data.status,
          createdAt: data.created_at,
          updatedAt: data.updated_at
        }
      : null
  });
}

async function handleReports(req: Request, env: Env) {
  const gate = await requireAdmin(req, env);
  if ("error" in gate && gate.error) return gate.error;
  if (!gate.viewer!.isStaff) return jsonErr("FORBIDDEN", "Staff required.", 403);
  const dashRes = await handleDashboard(req, env);
  const dashJson = (await dashRes.json()) as { data: Record<string, number> };
  const d = dashJson.data ?? {};
  return json({
    dashboard: d,
    totals: {
      orderCount: d.openOrders ?? 0,
      fulfilledCount: 0,
      cancelledCount: 0,
      invoiceCount: d.unpaidInvoices ?? 0,
      paidInvoiceCount: 0,
      outstandingBalance: d.outstandingBalance ?? 0,
      todayOrderTotal: d.todayOrderTotal ?? 0
    }
  });
}

async function handleApplications(req: Request, env: Env) {
  const v = await getViewer(req, env);
  if (!v) return jsonErr("UNAUTHORIZED", "Sign in required.", 401);
  if (!v.isManager) return jsonErr("FORBIDDEN", "Manager required.", 403);
  const sb = admin(env);
  const [biz, tax] = await Promise.all([
    sb
      .from("business_applications")
      .select(
        "id, application_number, legal_business_name, applicant_full_name, applicant_email, wholesale_status, tax_exemption_status, wholesale_requested, tax_exemption_requested, created_at"
      )
      .order("created_at", { ascending: false })
      .limit(50),
    sb
      .from("tax_exemption_applications")
      .select("id, status, business_name, contact_name, email, created_at")
      .order("created_at", { ascending: false })
      .limit(50)
  ]);
  return json({
    businessApplications: (biz.data ?? []).map((b) => ({
      id: b.id,
      number: b.application_number,
      company: b.legal_business_name,
      contact: b.applicant_full_name,
      email: b.applicant_email,
      wholesaleStatus: b.wholesale_status,
      taxStatus: b.tax_exemption_status,
      wholesaleRequested: b.wholesale_requested,
      taxRequested: b.tax_exemption_requested,
      createdAt: b.created_at
    })),
    taxExemptions: (tax.data ?? []).map((t) => ({
      id: t.id,
      status: t.status,
      legalName: t.business_name,
      contact: t.contact_name,
      email: t.email,
      createdAt: t.created_at
    }))
  });
}

async function handleAddressesGet(req: Request, env: Env) {
  const v = await getViewer(req, env);
  if (!v) return jsonErr("UNAUTHORIZED", "Sign in required.", 401);
  const sb = admin(env);
  const { data: cust } = await sb.from("customers").select("id").eq("auth_user_id", v.id).maybeSingle();
  if (!cust) return json({ addresses: [] });
  const { data } = await sb
    .from("customer_addresses")
    .select(
      "id, recipient_name, company_name, phone, note, line1, line2, city, state_region, postal_code, country_code, is_default"
    )
    .eq("customer_id", cust.id)
    .order("created_at", { ascending: false });
  return json({
    addresses: (data ?? []).map((a) => ({
      id: a.id,
      recipientName: a.recipient_name,
      companyName: a.company_name,
      phone: a.phone,
      note: a.note,
      line1: a.line1,
      line2: a.line2,
      city: a.city,
      state: a.state_region,
      postalCode: a.postal_code,
      country: a.country_code,
      isDefault: a.is_default
    }))
  });
}

async function handleAddressesPost(req: Request, env: Env) {
  const v = await getViewer(req, env);
  if (!v) return jsonErr("UNAUTHORIZED", "Sign in required.", 401);
  const body = (await req.json()) as Record<string, string | boolean | undefined>;
  const sb = admin(env);
  let { data: cust } = await sb.from("customers").select("id").eq("auth_user_id", v.id).maybeSingle();
  if (!cust) {
    const { data: created } = await sb
      .from("customers")
      .insert({
        auth_user_id: v.id,
        email: v.email,
        customer_type: "retail",
        status: "active"
      })
      .select("id")
      .single();
    cust = created;
  }
  if (!cust) return jsonErr("CUSTOMER_FAILED", "No customer profile.");
  const { data, error } = await sb
    .from("customer_addresses")
    .insert({
      customer_id: cust.id,
      recipient_name: String(body.recipientName ?? "").slice(0, 120) || v.fullName || "Customer",
      company_name: body.companyName ? String(body.companyName).slice(0, 120) : null,
      phone: body.phone ? String(body.phone).slice(0, 40) : null,
      note: body.note ? String(body.note).slice(0, 500) : null,
      line1: String(body.line1 ?? "").slice(0, 200),
      line2: body.line2 ? String(body.line2).slice(0, 200) : null,
      city: String(body.city ?? "").slice(0, 80),
      state_region: String(body.state ?? "").slice(0, 40),
      postal_code: String(body.postalCode ?? "").slice(0, 20),
      country_code: String(body.country ?? "US").slice(0, 2),
      is_default: Boolean(body.isDefault)
    })
    .select("id")
    .single();
  if (error) return jsonErr("ADDRESS_FAILED", error.message);
  return json({ id: data?.id }, 201);
}

// ---- Extended handlers (order detail, products CRUD, expenses, audit, settings, decisions)

async function handleCustomerOrderDetail(req: Request, env: Env, orderId: string) {
  const v = await getViewer(req, env);
  if (!v) return jsonErr("UNAUTHORIZED", "Sign in required.", 401);
  const sb = admin(env);
  const { data: cust } = await sb.from("customers").select("id").eq("auth_user_id", v.id).maybeSingle();
  if (!cust) return jsonErr("NOT_FOUND", "Order not found.", 404);

  const { data: order, error } = await sb
    .from("sales_orders")
    .select(
      `id, order_number, status, fulfillment_method, total_amount, subtotal, tax_amount, shipping_amount, discount_amount, currency, placed_at, created_at, notes, pickup_ready_at, picked_up_at, fulfilled_at, tracking_number, shipping_carrier, tracking_url, shipping_address_snapshot,
       items:sales_order_items ( id, product_name_snapshot, variant_name_snapshot, sku_snapshot, quantity, unit_price, line_total, line_note ),
       invoices ( id, amount_paid, total_amount, status, invoice_number, payments ( received_at, status, amount, payment_method, created_at ) )`
    )
    .eq("id", orderId)
    .eq("customer_id", cust.id)
    .maybeSingle();
  if (error) return jsonErr("LOAD_FAILED", error.message);
  if (!order) return jsonErr("NOT_FOUND", "Order not found.", 404);

  type Item = {
    id: string;
    product_name_snapshot: string;
    variant_name_snapshot: string | null;
    sku_snapshot: string;
    quantity: unknown;
    unit_price: unknown;
    line_total?: unknown;
    line_note: string | null;
  };
  const items = ((order.items as Item[] | null) ?? []).map((item) => {
    const quantity = num(item.quantity);
    const unitPrice = num(item.unit_price);
    return {
      id: item.id,
      name: item.product_name_snapshot,
      productName: item.product_name_snapshot,
      variantName: item.variant_name_snapshot,
      sku: item.sku_snapshot,
      quantity,
      unitPrice,
      lineTotal: item.line_total != null ? num(item.line_total) : quantity * unitPrice,
      note: item.line_note?.trim() || null,
      lineNote: item.line_note?.trim() || null
    };
  });
  const fulfillmentMethod = order.fulfillment_method ?? "pickup";
  const copy = customerStatusCopy({
    status: order.status,
    fulfillmentMethod,
    pickupReadyAt: order.pickup_ready_at ?? null,
    pickedUpAt: order.picked_up_at ?? null
  });
  const payment = mapCustomerPayment(order as Parameters<typeof mapCustomerPayment>[0]);
  const inv = Array.isArray(order.invoices) ? order.invoices[0] : order.invoices;

  return json({
    order: {
      id: order.id,
      number: order.order_number ?? order.id.slice(0, 8),
      status: order.status,
      fulfillmentMethod,
      total: num(order.total_amount),
      subtotal: num(order.subtotal),
      tax: num(order.tax_amount),
      shipping: num(order.shipping_amount),
      discount: num(order.discount_amount),
      currency: order.currency ?? "USD",
      placedAt: order.placed_at ?? order.created_at,
      createdAt: order.created_at,
      notes: order.notes,
      pickupReadyAt: order.pickup_ready_at,
      pickedUpAt: order.picked_up_at,
      fulfilledAt: order.fulfilled_at,
      trackingNumber: order.tracking_number,
      shippingCarrier: order.shipping_carrier,
      trackingUrl: order.tracking_url,
      shippingAddress: order.shipping_address_snapshot,
      paidAt: payment.paidAt,
      paymentMethod: payment.paymentMethod,
      paymentStatus: payment.paymentStatus,
      invoiceNumber:
        inv && typeof inv === "object" && "invoice_number" in inv
          ? ((inv as { invoice_number?: string }).invoice_number ?? null)
          : null,
      statusLabel: copy.label,
      statusDetail: copy.detail,
      isOpen: copy.isOpen,
      itemCount: items.length,
      items,
      // staff action flags unused for customer
      canMarkPickupReady: false,
      canConfirmPickedUp: false,
      canCancel: false,
      canEditTracking: false,
      canConfirmPayment: false
    }
  });
}

async function handleStaffOrderDetail(req: Request, env: Env, orderId: string) {
  const gate = await requireAdmin(req, env);
  if ("error" in gate && gate.error) return gate.error;
  const sb = admin(env);
  const { data: order, error } = await sb
    .from("sales_orders")
    .select(
      `id, order_number, status, fulfillment_method, total_amount, subtotal, tax_amount, shipping_amount, discount_amount, currency, created_at, notes,
       pickup_ready_at, picked_up_at, fulfilled_at, tracking_number, shipping_carrier, tracking_url, payment_method, payment_reference, shipping_address_snapshot, cancelled_at, cancel_note, cancelled_by_name, picked_up_by_name, shipped_at,
       customers ( first_name, last_name, company_name, phone, email, notes ),
       items:sales_order_items ( id, product_name_snapshot, variant_name_snapshot, sku_snapshot, quantity, unit_price, line_total, line_note ),
       invoices ( id, invoice_number, amount_paid, total_amount, balance_due, status )`
    )
    .eq("id", orderId)
    .maybeSingle();
  if (error) return jsonErr("LOAD_FAILED", error.message);
  if (!order) return jsonErr("NOT_FOUND", "Order not found.", 404);

  const c = order.customers as {
    first_name: string | null;
    last_name: string | null;
    company_name: string | null;
    phone: string | null;
    email: string | null;
    notes: string | null;
  } | null;

  type Item = {
    id: string;
    product_name_snapshot: string;
    variant_name_snapshot: string | null;
    sku_snapshot: string;
    quantity: unknown;
    unit_price: unknown;
    line_total?: unknown;
    line_note: string | null;
  };
  const items = ((order.items as Item[] | null) ?? []).map((item) => {
    const quantity = num(item.quantity);
    const unitPrice = num(item.unit_price);
    return {
      id: item.id,
      name: item.product_name_snapshot,
      productName: item.product_name_snapshot,
      variantName: item.variant_name_snapshot,
      sku: item.sku_snapshot,
      quantity,
      unitPrice,
      lineTotal: item.line_total != null ? num(item.line_total) : quantity * unitPrice,
      note: item.line_note?.trim() || null,
      lineNote: item.line_note?.trim() || null
    };
  });

  const awaitingPickupPrep =
    order.status === "confirmed" && order.fulfillment_method === "pickup" && !order.pickup_ready_at;
  const awaitingPickup =
    order.status === "confirmed" &&
    order.fulfillment_method === "pickup" &&
    Boolean(order.pickup_ready_at) &&
    !order.picked_up_at;
  const awaitingDelivery =
    order.status === "confirmed" && order.fulfillment_method === "ship" && !order.fulfilled_at;

  const invList = Array.isArray(order.invoices) ? order.invoices : order.invoices ? [order.invoices] : [];
  const inv = invList[0] as
    | { id?: string; invoice_number?: string; amount_paid?: unknown; total_amount?: unknown; balance_due?: unknown; status?: string }
    | undefined;
  const balanceDue = inv ? num(inv.balance_due) : 0;
  const amountPaid = inv ? num(inv.amount_paid) : 0;

  return json({
    order: {
      id: order.id,
      number: order.order_number ?? order.id.slice(0, 8),
      status: order.status,
      fulfillmentMethod: order.fulfillment_method,
      total: num(order.total_amount),
      subtotal: num(order.subtotal),
      tax: num(order.tax_amount),
      shipping: num(order.shipping_amount),
      discount: num(order.discount_amount),
      currency: order.currency ?? "USD",
      createdAt: order.created_at,
      placedAt: order.created_at,
      notes: order.notes,
      pickupReadyAt: order.pickup_ready_at,
      pickedUpAt: order.picked_up_at,
      fulfilledAt: order.fulfilled_at,
      trackingNumber: order.tracking_number,
      shippingCarrier: order.shipping_carrier,
      trackingUrl: order.tracking_url,
      shippingAddress: order.shipping_address_snapshot,
      paymentMethod: order.payment_method,
      paymentReference: order.payment_reference,
      paymentStatus: balanceDue <= 0 && amountPaid > 0 ? "paid" : balanceDue > 0 && amountPaid > 0 ? "partial" : amountPaid <= 0 && order.status !== "cancelled" ? "pending" : "none",
      invoiceNumber: inv?.invoice_number ?? null,
      amountPaid,
      balanceDue,
      cancelledAt: order.cancelled_at,
      cancelNote: order.cancel_note,
      cancelledByName: order.cancelled_by_name,
      pickedUpByName: order.picked_up_by_name,
      shippedAt: order.shipped_at,
      statusLabel:
        order.status === "cancelled"
          ? "Cancelled"
          : order.status === "fulfilled"
            ? "Completed"
            : awaitingPickup
              ? "Ready for pickup"
              : awaitingPickupPrep
                ? "Preparing"
                : awaitingDelivery
                  ? "Awaiting ship"
                  : order.status,
      statusDetail: awaitingPickup
        ? "Customer can collect at store"
        : awaitingPickupPrep
          ? "Staff preparing pickup order"
          : awaitingDelivery
            ? "Ship / deliver this order"
            : null,
      isOpen: order.status === "confirmed",
      customer: {
        name: [c?.first_name, c?.last_name].filter(Boolean).join(" ") || c?.company_name || "Customer",
        company: c?.company_name,
        phone: c?.phone,
        email: c?.email,
        notes: c?.notes
      },
      items,
      itemCount: items.length,
      canMarkPickupReady: awaitingPickupPrep,
      canConfirmPickedUp: awaitingPickup,
      canCancel: order.status === "confirmed",
      canEditTracking: order.fulfillment_method === "ship" && order.status === "confirmed",
      canConfirmPayment: balanceDue > 0,
      canCancelPickup: Boolean(order.picked_up_at) && order.status === "fulfilled" && order.fulfillment_method === "pickup"
    }
  });
}

function slugify(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60) || `item-${Date.now()}`;
}

async function handleProductCreate(req: Request, env: Env) {
  const gate = await requireAdmin(req, env);
  if ("error" in gate && gate.error) return gate.error;
  const viewer = gate.viewer!;
  const body = (await req.json()) as Record<string, unknown>;
  const name = String(body.name ?? "").trim();
  if (!name) return jsonErr("BAD_REQUEST", "Name is required.");
  const slug = String(body.slug ?? slugify(name)).trim();
  const sku = String(body.sku ?? `SKU-${Date.now().toString(36).toUpperCase()}`).trim();
  const retail = num(body.retailPrice);
  let cost = num(body.costPrice);
  if (viewer.isSeller) cost = 0;
  const status = String(body.status ?? "active");
  const shortDescription = String(body.shortDescription ?? "").slice(0, 300);
  const description = String(body.description ?? "").slice(0, 5000);
  const openingQty = Math.max(0, num(body.openingQuantity));
  const categoryId = body.categoryId ? String(body.categoryId) : null;

  const sb = admin(env);
  const { data: product, error: pErr } = await sb
    .from("products")
    .insert({
      product_handle: slug,
      slug,
      name,
      short_description: shortDescription || null,
      description: description || null,
      status,
      featured: Boolean(body.featured),
      published_at: status === "active" ? new Date().toISOString() : null,
      created_by: viewer.id,
      updated_by: viewer.id
    })
    .select("id")
    .single();
  if (pErr || !product) return jsonErr("CREATE_FAILED", pErr?.message ?? "Create failed.");

  const { data: variant, error: vErr } = await sb
    .from("product_variants")
    .insert({
      product_id: product.id,
      variant_name: String(body.variantName ?? "Default"),
      sku,
      barcode: body.barcode ? String(body.barcode).trim() : null,
      retail_price: retail,
      sale_price: body.salePrice != null ? num(body.salePrice) : null,
      wholesale_price: body.wholesalePrice != null ? num(body.wholesalePrice) : null,
      cost_price: cost,
      taxable: body.taxable !== false,
      tax_category: String(body.taxCategory ?? "grocery"),
      track_inventory: body.trackInventory !== false,
      is_default: true,
      is_active: true
    })
    .select("id")
    .single();

  if (vErr || !variant) {
    await sb.from("products").delete().eq("id", product.id);
    return jsonErr("VARIANT_FAILED", vErr?.message ?? "Variant failed.");
  }

  if (categoryId) {
    await sb.from("product_categories").insert({
      product_id: product.id,
      category_id: categoryId,
      is_primary: true
    });
  }

  if (openingQty > 0) {
    const { data: loc } = await sb
      .from("inventory_locations")
      .select("id")
      .eq("code", PICKUP_CODE)
      .maybeSingle();
    if (loc?.id) {
      await sb.from("inventory_movements").insert({
        variant_id: variant.id,
        location_id: loc.id,
        movement_type: "opening",
        quantity_change: openingQty,
        unit_cost: cost,
        reason: "Opening balance (mobile)",
        created_by: viewer.id
      });
    }
  }

  await sb.from("audit_log").insert({
    actor_user_id: viewer.id,
    action: "product.create",
    entity_type: "product",
    entity_id: product.id,
    after_data: { name, slug, sku, retail, cost },
    metadata: { source: "mobile" }
  });

  return json({ id: product.id, slug, sku }, 201);
}

async function handleProductUpdate(req: Request, env: Env, id: string) {
  const gate = await requireAdmin(req, env);
  if ("error" in gate && gate.error) return gate.error;
  const viewer = gate.viewer!;
  const body = (await req.json()) as Record<string, unknown>;
  const sb = admin(env);

  const productPatch: Record<string, unknown> = { updated_by: viewer.id, updated_at: new Date().toISOString() };
  if (body.name != null) productPatch.name = String(body.name).trim();
  if (body.shortDescription != null) productPatch.short_description = String(body.shortDescription);
  if (body.description != null) productPatch.description = String(body.description);
  if (body.status != null) productPatch.status = String(body.status);
  if (body.featured != null) productPatch.featured = Boolean(body.featured);

  const { error: pErr } = await sb.from("products").update(productPatch).eq("id", id);
  if (pErr) return jsonErr("UPDATE_FAILED", pErr.message);

  const { data: variants } = await sb
    .from("product_variants")
    .select("id")
    .eq("product_id", id)
    .eq("is_default", true)
    .limit(1);
  const variantId = variants?.[0]?.id;
  if (variantId) {
    const vp: Record<string, unknown> = {};
    if (body.retailPrice != null) vp.retail_price = num(body.retailPrice);
    if (body.salePrice !== undefined) vp.sale_price = body.salePrice == null ? null : num(body.salePrice);
    if (body.sku != null) vp.sku = String(body.sku);
    if (body.barcode !== undefined) {
      const barcode = String(body.barcode ?? "").trim();
      vp.barcode = barcode || null;
    }
    if (!viewer.isSeller && body.costPrice != null) vp.cost_price = num(body.costPrice);
    if (Object.keys(vp).length) {
      await sb.from("product_variants").update(vp).eq("id", variantId);
    }
  }

  await sb.from("audit_log").insert({
    actor_user_id: viewer.id,
    action: "product.update",
    entity_type: "product",
    entity_id: id,
    after_data: body,
    metadata: { source: "mobile" }
  });

  return json({ ok: true, id });
}

async function handleExpensesList(req: Request, env: Env) {
  const gate = await requireAdmin(req, env);
  if ("error" in gate && gate.error) return gate.error;
  if (!gate.viewer!.isStaff && !gate.viewer!.isManager) {
    return jsonErr("FORBIDDEN", "Staff required.", 403);
  }
  const sb = admin(env);
  const { data, error } = await sb
    .from("expenses")
    .select(
      "id, expense_date, vendor_name, description, amount, tax_amount, currency, payment_method, notes, expense_categories ( name )"
    )
    .order("expense_date", { ascending: false })
    .limit(100);
  if (error) return jsonErr("LOAD_FAILED", error.message);
  return json({
    expenses: (data ?? []).map((e) => {
      const cat = e.expense_categories as { name: string } | null;
      return {
        id: e.id,
        date: e.expense_date,
        vendor: e.vendor_name,
        description: e.description,
        amount: num(e.amount),
        tax: num(e.tax_amount),
        currency: e.currency,
        paymentMethod: e.payment_method,
        notes: e.notes,
        category: cat?.name ?? null
      };
    })
  });
}

async function handleExpenseCreate(req: Request, env: Env) {
  const gate = await requireAdmin(req, env);
  if ("error" in gate && gate.error) return gate.error;
  if (!gate.viewer!.isManager) return jsonErr("FORBIDDEN", "Manager required.", 403);
  const body = (await req.json()) as Record<string, unknown>;
  const description = String(body.description ?? "").trim();
  const amount = num(body.amount);
  if (!description || amount <= 0) return jsonErr("BAD_REQUEST", "Description and amount required.");

  const sb = admin(env);
  let categoryId = body.categoryId ? String(body.categoryId) : null;
  if (!categoryId) {
    const { data: cats } = await sb.from("expense_categories").select("id").eq("is_active", true).limit(1);
    categoryId = cats?.[0]?.id ?? null;
    if (!categoryId) {
      const { data: created } = await sb
        .from("expense_categories")
        .insert({ name: "General", description: "Default" })
        .select("id")
        .single();
      categoryId = created?.id ?? null;
    }
  }
  if (!categoryId) return jsonErr("CONFIG", "No expense category.");

  const { data, error } = await sb
    .from("expenses")
    .insert({
      expense_category_id: categoryId,
      expense_date: String(body.date ?? new Date().toISOString().slice(0, 10)),
      vendor_name: body.vendor ? String(body.vendor).slice(0, 120) : null,
      description: description.slice(0, 500),
      amount,
      tax_amount: num(body.tax),
      payment_method: body.paymentMethod ? String(body.paymentMethod) : null,
      notes: body.notes ? String(body.notes).slice(0, 500) : null,
      created_by: gate.viewer!.id
    })
    .select("id")
    .single();
  if (error) return jsonErr("CREATE_FAILED", error.message);
  return json({ id: data?.id }, 201);
}

async function handleAuditLog(req: Request, env: Env) {
  const v = await getViewer(req, env);
  if (!v) return jsonErr("UNAUTHORIZED", "Sign in required.", 401);
  if (!v.isAdmin && !v.isManager) return jsonErr("FORBIDDEN", "Manager/admin required.", 403);
  const sb = admin(env);
  const { data, error } = await sb
    .from("audit_log")
    .select("id, actor_user_id, action, entity_type, entity_id, created_at, metadata")
    .order("created_at", { ascending: false })
    .limit(80);
  if (error) return jsonErr("LOAD_FAILED", error.message);
  return json({
    entries: (data ?? []).map((e) => ({
      id: String(e.id),
      actorUserId: e.actor_user_id,
      action: e.action,
      entityType: e.entity_type,
      entityId: e.entity_id,
      createdAt: e.created_at,
      metadata: e.metadata
    }))
  });
}

async function handleSettingsGet(req: Request, env: Env) {
  const gate = await requireAdmin(req, env);
  if ("error" in gate && gate.error) return gate.error;
  if (!gate.viewer!.isManager) return jsonErr("FORBIDDEN", "Manager required.", 403);
  const sb = admin(env);
  const { data } = await sb.from("app_settings").select("key, value, is_public, description, updated_at").limit(50);
  return json({
    settings: (data ?? []).map((s) => ({
      key: s.key,
      value: s.value,
      isPublic: s.is_public,
      description: s.description,
      updatedAt: s.updated_at
    }))
  });
}

async function handleSettingsPatch(req: Request, env: Env) {
  const gate = await requireAdmin(req, env);
  if ("error" in gate && gate.error) return gate.error;
  if (!gate.viewer!.isManager) return jsonErr("FORBIDDEN", "Manager required.", 403);
  const body = (await req.json()) as { key?: string; value?: unknown };
  const key = String(body.key ?? "").trim();
  if (!key) return jsonErr("BAD_REQUEST", "key required.");
  const sb = admin(env);
  const { error } = await sb.from("app_settings").upsert({
    key,
    value: body.value ?? {},
    updated_by: gate.viewer!.id,
    updated_at: new Date().toISOString()
  });
  if (error) return jsonErr("UPDATE_FAILED", error.message);
  return json({ ok: true, key });
}

async function handleApplicationDecide(req: Request, env: Env) {
  const v = await getViewer(req, env);
  if (!v) return jsonErr("UNAUTHORIZED", "Sign in required.", 401);
  if (!v.isManager) return jsonErr("FORBIDDEN", "Manager required.", 403);
  const body = (await req.json()) as {
    type?: "business_wholesale" | "business_tax" | "tax_exemption";
    id?: string;
    decision?: "approved" | "rejected" | "under_review";
    reason?: string;
  };
  const id = body.id ?? "";
  const decision = body.decision ?? "";
  if (!id || !decision) return jsonErr("BAD_REQUEST", "id and decision required.");
  const sb = admin(env);
  const now = new Date().toISOString();

  if (body.type === "tax_exemption") {
    if (decision !== "approved" && decision !== "rejected") {
      return jsonErr("BAD_REQUEST", "Tax exemption decision must be approved or rejected.");
    }
    const { error } = await sb
      .from("tax_exemption_applications")
      .update({
        status: decision,
        reviewed_at: now,
        reviewed_by: v.id,
        review_note: (body.reason ?? "").slice(0, 500) || null
      })
      .eq("id", id);
    if (error) return jsonErr("DECIDE_FAILED", error.message);
    return json({ ok: true });
  }

  // business_applications tracks
  const patch: Record<string, unknown> = {};
  if (body.type === "business_tax") {
    patch.tax_exemption_status = decision;
    patch.tax_decided_by = v.id;
    patch.tax_decided_at = now;
    patch.tax_decision_reason = (body.reason ?? "").slice(0, 500) || null;
  } else {
    patch.wholesale_status = decision;
    patch.wholesale_decided_by = v.id;
    patch.wholesale_decided_at = now;
    patch.wholesale_decision_reason = (body.reason ?? "").slice(0, 500) || null;
  }
  const { error } = await sb.from("business_applications").update(patch).eq("id", id);
  if (error) return jsonErr("DECIDE_FAILED", error.message);
  return json({ ok: true });
}
