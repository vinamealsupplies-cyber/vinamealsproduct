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
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
  /** Optional — for shipping proof upload to private documents bucket */
  CLOUDFLARE_ACCOUNT_ID?: string;
  R2_ACCESS_KEY_ID?: string;
  R2_SECRET_ACCESS_KEY?: string;
  R2_DOCUMENTS_BUCKET?: string;
  /** Optional — public product-image bucket (same names the website uses) */
  R2_BUCKET?: string;
  R2_PUBLIC_BASE_URL?: string;
  /** Optional — Cloudflare Stream for product video (same names the website uses) */
  CLOUDFLARE_STREAM_API_TOKEN?: string;
  CLOUDFLARE_STREAM_CUSTOMER_CODE?: string;
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

function escapeEmailHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function sendMobileEmail(
  env: Env,
  input: { to: string; subject: string; text: string; html: string }
): Promise<{ sent: boolean; error?: string }> {
  if (!env.RESEND_API_KEY) return { sent: false, error: "Email service is not configured." };
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: env.EMAIL_FROM || "Vinameals <support@vinamealsupplies.com>",
        to: [input.to],
        reply_to: "support@vinamealsupplies.com",
        subject: input.subject,
        text: input.text,
        html: input.html
      })
    });
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { message?: string } | null;
      return { sent: false, error: payload?.message || `Email service returned ${response.status}.` };
    }
    return { sent: true };
  } catch (error) {
    return { sent: false, error: error instanceof Error ? error.message : "Could not send email." };
  }
}

function customerOrderUrl(orderNumber: string | null | undefined, orderId: string) {
  const identifier = (orderNumber || orderId).trim();
  return `https://vinamealsupplies.com/account/orders/${encodeURIComponent(identifier)}`;
}

function trackingUrlFor(carrier: string, tracking: string): string | null {
  const code = encodeURIComponent(tracking);
  if (carrier === "usps") return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${code}`;
  if (carrier === "ups") return `https://www.ups.com/track?tracknum=${code}`;
  if (carrier === "fedex") return `https://www.fedex.com/fedextrack/?trknbr=${code}`;
  if (carrier === "dhl") return `https://www.dhl.com/us-en/home/tracking.html?tracking-id=${code}`;
  return null;
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
      if (path === "/api/mobile/v1/management/customers" && req.method === "POST") {
        return handleCustomerCreate(req, env);
      }
      if (path.match(/^\/api\/mobile\/v1\/management\/customers\/[^/]+$/) && req.method === "PATCH") {
        const id = path.split("/")[6];
        return handleCustomerUpdate(req, env, id);
      }
      if (path === "/api/mobile/v1/management/products" && req.method === "GET") {
        return handleProducts(req, env, url);
      }
      if (path === "/api/mobile/v1/management/products" && req.method === "POST") {
        return handleProductCreate(req, env);
      }
      if (path.match(/^\/api\/mobile\/v1\/management\/products\/[^/]+\/report$/) && req.method === "GET") {
        const id = path.split("/")[6];
        return handleProductSalesReport(req, env, id, url);
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
      if (path === "/api/mobile/v1/management/activity" && req.method === "GET") {
        return handleEntityActivity(req, env, url);
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
      if (path.match(/^\/api\/mobile\/v1\/management\/applications\/[^/]+\/[^/]+$/) && req.method === "GET") {
        const parts = path.split("/");
        return handleApplicationDetail(req, env, parts[6], parts[7]);
      }
      if (path === "/api/mobile/v1/management/invoices" && req.method === "GET") {
        return handleInvoices(req, env);
      }
      if (path.match(/^\/api\/mobile\/v1\/management\/invoices\/[^/]+\/payments$/) && req.method === "POST") {
        const id = path.split("/")[6];
        return handleInvoicePayment(req, env, id);
      }
      if (path.match(/^\/api\/mobile\/v1\/management\/invoices\/[^/]+$/) && req.method === "GET") {
        const id = path.split("/")[6];
        return handleInvoiceDetail(req, env, id);
      }
      if (path === "/api/mobile/v1/management/categories" && req.method === "GET") {
        return handleCategories(req, env);
      }
      if (path === "/api/mobile/v1/management/categories" && req.method === "POST") {
        return handleCategoryCreate(req, env);
      }
      if (path.match(/^\/api\/mobile\/v1\/management\/categories\/[^/]+$/) && req.method === "PATCH") {
        const id = path.split("/")[6];
        return handleCategoryUpdate(req, env, id);
      }
      if (path.match(/^\/api\/mobile\/v1\/management\/categories\/[^/]+\/delete$/) && req.method === "POST") {
        const id = path.split("/")[6];
        return handleCategoryDelete(req, env, id);
      }
      if (path.match(/^\/api\/mobile\/v1\/management\/products\/[^/]+\/media$/) && req.method === "GET") {
        const id = path.split("/")[6];
        return handleProductMediaList(req, env, id);
      }
      if (path.match(/^\/api\/mobile\/v1\/management\/products\/[^/]+\/media$/) && req.method === "POST") {
        const id = path.split("/")[6];
        return handleProductMediaUpload(req, env, id);
      }
      if (path.match(/^\/api\/mobile\/v1\/management\/products\/[^/]+\/media\/[^/]+\/delete$/) && req.method === "POST") {
        const parts = path.split("/");
        return handleProductMediaDelete(req, env, parts[6], parts[8]);
      }
      if (path.match(/^\/api\/mobile\/v1\/management\/products\/[^/]+\/video\/presign$/) && req.method === "POST") {
        const id = path.split("/")[6];
        return handleProductVideoPresign(req, env, id);
      }
      if (path.match(/^\/api\/mobile\/v1\/management\/products\/[^/]+\/video\/complete$/) && req.method === "POST") {
        const id = path.split("/")[6];
        return handleProductVideoComplete(req, env, id);
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
      if (path === "/api/mobile/v1/business-application" && req.method === "GET") {
        return handleBusinessApplicationGet(req, env);
      }
      if (path === "/api/mobile/v1/business-application" && req.method === "POST") {
        return handleBusinessApplicationPost(req, env);
      }
      if (path === "/api/mobile/v1/account/delete" && req.method === "POST") {
        return handleAccountDelete(req, env);
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
  const sb = admin(env);
  const [profileRes, customerRes, appRes] = await Promise.all([
    sb.from("profiles").select("phone").eq("id", v.id).maybeSingle(),
    sb
      .from("customers")
      .select("company_name, customer_type, wholesale_status, tax_exempt_status")
      .eq("auth_user_id", v.id)
      .maybeSingle(),
    sb
      .from("business_applications")
      .select("id", { count: "exact", head: true })
      .eq("auth_user_id", v.id)
  ]);
  const customer = customerRes.data;
  return json({
    id: v.id,
    email: v.email,
    fullName: v.fullName,
    phone: profileRes.data?.phone ?? null,
    role: v.role,
    isStaff: v.isStaff,
    isManager: v.isManager,
    isAdmin: v.isAdmin,
    isSeller: v.isSeller,
    canAccessManagement: v.canAccessAdmin,
    companyName: customer?.company_name ?? null,
    customerType: customer?.customer_type ?? null,
    wholesaleStatus: customer?.wholesale_status ?? "not_requested",
    taxExemptStatus: customer?.tax_exempt_status ?? "not_requested",
    hasBusinessApplication: (appRes.count ?? 0) > 0
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

// ---- Customer: business / wholesale + tax-exemption application ----

const BA_STATUS_LABELS: Record<string, string> = {
  not_requested: "Not requested",
  pending_review: "Pending review",
  under_review: "Under review",
  more_info_required: "More info required",
  approved: "Approved",
  rejected: "Rejected",
  expired: "Expired",
  suspended: "Suspended",
  revoked: "Revoked"
};

async function handleBusinessApplicationGet(req: Request, env: Env) {
  const v = await getViewer(req, env);
  if (!v) return jsonErr("UNAUTHORIZED", "Sign in required.", 401);
  const sb = admin(env);
  const { data: customer } = await sb
    .from("customers")
    .select("company_name, customer_type, wholesale_status, tax_exempt_status")
    .eq("auth_user_id", v.id)
    .maybeSingle();
  const { data: apps } = await sb
    .from("business_applications")
    .select(
      "id, application_number, legal_business_name, wholesale_requested, tax_exemption_requested, wholesale_status, tax_exemption_status, customer_visible_message, submitted_at, created_at"
    )
    .eq("auth_user_id", v.id)
    .order("submitted_at", { ascending: false })
    .limit(20);
  return json({
    customer: {
      companyName: customer?.company_name ?? null,
      customerType: customer?.customer_type ?? null,
      wholesaleStatus: customer?.wholesale_status ?? "not_requested",
      taxExemptStatus: customer?.tax_exempt_status ?? "not_requested"
    },
    applications: (apps ?? []).map((a) => ({
      id: a.id,
      number: a.application_number,
      company: a.legal_business_name,
      wholesaleRequested: a.wholesale_requested,
      taxRequested: a.tax_exemption_requested,
      wholesaleStatus: a.wholesale_status,
      wholesaleStatusLabel: BA_STATUS_LABELS[a.wholesale_status] ?? a.wholesale_status,
      taxStatus: a.tax_exemption_status,
      taxStatusLabel: BA_STATUS_LABELS[a.tax_exemption_status] ?? a.tax_exemption_status,
      message: a.customer_visible_message ?? null,
      submittedAt: a.submitted_at ?? a.created_at
    }))
  });
}

type IncomingDoc = {
  base64?: string;
  filename?: string;
  contentType?: string;
  documentType?: string;
};

async function handleBusinessApplicationPost(req: Request, env: Env) {
  const v = await getViewer(req, env);
  if (!v) return jsonErr("UNAUTHORIZED", "Sign in required.", 401);
  const body = (await req.json()) as Record<string, unknown>;

  const str = (k: string, max = 200) => String(body[k] ?? "").trim().slice(0, max);
  const wholesaleRequested = Boolean(body.wholesaleRequested);
  const taxExemptionRequested = Boolean(body.taxExemptionRequested);
  if (!wholesaleRequested && !taxExemptionRequested) {
    return jsonErr("BAD_REQUEST", "Request wholesale pricing, tax exemption, or both.");
  }

  // Required fields (mirror business_applications NOT NULL columns)
  const required: Array<[string, string]> = [
    ["applicantFullName", "Applicant full name"],
    ["applicantJobTitle", "Job title"],
    ["applicantEmail", "Applicant email"],
    ["applicantPhone", "Applicant phone"],
    ["legalBusinessName", "Legal business name"],
    ["entityType", "Business entity type"],
    ["businessCategory", "Business category"],
    ["businessDescription", "Business description"],
    ["businessStreet", "Business street"],
    ["businessCity", "Business city"],
    ["businessState", "Business state"],
    ["businessZip", "Business ZIP"],
    ["signerName", "Signer name"],
    ["signerTitle", "Signer title"],
    ["electronicSignature", "Electronic signature"]
  ];
  for (const [key, label] of required) {
    if (!str(key)) return jsonErr("BAD_REQUEST", `${label} is required.`);
  }

  const docs = Array.isArray(body.documents) ? (body.documents as IncomingDoc[]) : [];
  if (!docs.length) {
    return jsonErr("DOC_REQUIRED", "Upload at least one supporting document (resale/exemption certificate or business license).");
  }
  if (docs.length > 5) return jsonErr("BAD_REQUEST", "Upload at most 5 files.");

  const sb = admin(env);
  // Find or create the customer row for this auth user.
  let { data: customer } = await sb
    .from("customers")
    .select("id, company_name")
    .eq("auth_user_id", v.id)
    .maybeSingle();
  if (!customer) {
    const { data: created } = await sb
      .from("customers")
      .insert({ auth_user_id: v.id, email: v.email, customer_type: "retail", status: "active" })
      .select("id, company_name")
      .single();
    customer = created;
  }
  if (!customer) return jsonErr("CUSTOMER_FAILED", "No customer profile could be created.");

  const wholesaleStatus = wholesaleRequested ? "pending_review" : "not_requested";
  const taxStatus = taxExemptionRequested ? "pending_review" : "not_requested";

  const yearsRaw = num(body.yearsInBusiness);
  const insertRow: Record<string, unknown> = {
    customer_id: customer.id,
    auth_user_id: v.id,
    applicant_full_name: str("applicantFullName", 120),
    applicant_job_title: str("applicantJobTitle", 120),
    applicant_email: str("applicantEmail", 200),
    applicant_phone: str("applicantPhone", 40),
    preferred_contact_method: str("preferredContactMethod", 40) || null,
    legal_business_name: str("legalBusinessName", 200),
    dba_name: str("dbaName", 200) || null,
    entity_type: str("entityType", 60),
    business_category: str("businessCategory", 80),
    business_description: str("businessDescription", 2000),
    website_url: str("websiteUrl", 300) || null,
    years_in_business: yearsRaw > 0 ? Math.floor(yearsRaw) : null,
    estimated_monthly_volume: str("estimatedMonthlyVolume", 60) || null,
    business_street: str("businessStreet", 200),
    business_address_line_2: str("businessAddressLine2", 200) || null,
    business_city: str("businessCity", 80),
    business_state: str("businessState", 40),
    business_zip: str("businessZip", 20),
    business_country: str("businessCountry", 2) || "US",
    wholesale_requested: wholesaleRequested,
    tax_exemption_requested: taxExemptionRequested,
    wholesale_status: wholesaleStatus,
    tax_exemption_status: taxStatus,
    intended_use: str("intendedUse", 200) || null,
    wholesale_notes: str("wholesaleNotes", 1000) || null,
    signer_name: str("signerName", 120),
    signer_title: str("signerTitle", 120),
    electronic_signature: str("electronicSignature", 200),
    signed_at: new Date().toISOString(),
    ip_address:
      req.headers.get("cf-connecting-ip") ||
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      null,
    user_agent: req.headers.get("user-agent")?.slice(0, 500) ?? null
  };
  if (taxExemptionRequested) {
    insertRow.exemption_type = str("exemptionType", 80) || null;
    insertRow.issuing_state = str("issuingState", 40) || null;
    insertRow.permit_number = str("permitNumber", 80) || null;
    insertRow.resale_product_description = str("resaleProductDescription", 1000) || null;
  }

  const { data: application, error: insertError } = await sb
    .from("business_applications")
    .insert(insertRow)
    .select("id, application_number, submitted_at, wholesale_status, tax_exemption_status")
    .single();
  if (insertError) {
    if (insertError.code === "23505") {
      return jsonErr("DUPLICATE", "You already have an application open for review.");
    }
    return jsonErr("INSERT_FAILED", insertError.message);
  }

  // Upload + record documents. Roll back the application if any doc fails.
  try {
    for (const doc of docs) {
      if (!doc.base64) throw new Error("A document had no file data.");
      const uploaded = await uploadBusinessDocR2(env, customer.id, doc.base64);
      if ("error" in uploaded) throw new Error(uploaded.error);
      const { error: docErr } = await sb.from("application_documents").insert({
        application_id: application.id,
        document_type: String(doc.documentType ?? "Supporting document").slice(0, 120),
        original_filename: doc.filename ? String(doc.filename).slice(0, 200) : null,
        storage_path: uploaded.key,
        mime_type: uploaded.mime,
        file_size: uploaded.bytes,
        uploaded_by: v.id
      });
      if (docErr) throw new Error(docErr.message);
    }
  } catch (e) {
    await sb.from("business_applications").delete().eq("id", application.id);
    return jsonErr("DOC_UPLOAD_FAILED", e instanceof Error ? e.message : "Documents could not be stored.");
  }

  // Mirror pending status onto the customer record (runtime source of truth).
  const customerPatch: Record<string, unknown> = { company_name: str("legalBusinessName", 200) };
  if (wholesaleRequested) {
    customerPatch.wholesale_status = "pending_review";
    customerPatch.wholesale_application_id = application.id;
  }
  if (taxExemptionRequested) customerPatch.tax_exempt_status = "pending";
  await sb.from("customers").update(customerPatch).eq("id", customer.id);

  return json(
    {
      id: application.id,
      applicationNumber: application.application_number,
      wholesaleStatus: application.wholesale_status,
      taxStatus: application.tax_exemption_status
    },
    201
  );
}

async function uploadBusinessDocR2(
  env: Env,
  customerId: string,
  base64: string
): Promise<{ key: string; mime: string; bytes: number } | { error: string }> {
  if (
    !env.CLOUDFLARE_ACCOUNT_ID ||
    !env.R2_ACCESS_KEY_ID ||
    !env.R2_SECRET_ACCESS_KEY ||
    !env.R2_DOCUMENTS_BUCKET
  ) {
    return { error: "Document storage is not configured on the mobile-api worker." };
  }
  const cleaned = base64.replace(/^data:[^;]+;base64,/, "");
  let binary: Uint8Array;
  try {
    const raw = atob(cleaned);
    binary = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) binary[i] = raw.charCodeAt(i);
  } catch {
    return { error: "Invalid file encoding." };
  }
  if (binary.byteLength <= 0) return { error: "Empty file." };
  if (binary.byteLength > 10 * 1024 * 1024) return { error: "File larger than 10 MB." };
  const detected = detectProofType(binary);
  if (!detected) return { error: "Only real PDF, JPEG, PNG, or WebP files are accepted." };

  const key = `business-applications/${customerId}/${crypto.randomUUID()}.${detected.extension}`;
  const { AwsClient } = await import("aws4fetch");
  const client = new AwsClient({
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY
  });
  const url = `https://${env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com/${env.R2_DOCUMENTS_BUCKET}/${key}`;
  const res = await client.fetch(url, {
    method: "PUT",
    headers: { "Content-Type": detected.contentType },
    body: binary
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return { error: `Document upload failed (${res.status}): ${text.slice(0, 160)}` };
  }
  return { key, mime: detected.contentType, bytes: binary.byteLength };
}

// ---- Customer: delete account (Apple 5.1.1(v)) ----
// Anonymizes PII and removes the sign-in. customers.auth_user_id is ON DELETE SET NULL,
// so order/invoice history stays intact for legal retention.
async function handleAccountDelete(req: Request, env: Env) {
  const v = await getViewer(req, env);
  if (!v) return jsonErr("UNAUTHORIZED", "Sign in required.", 401);
  const sb = admin(env);
  const stamp = Date.now();
  const anonEmail = `deleted+${v.id}@deleted.vinamealsupplies.com`;

  // 1) Scrub customer PII but keep the row (orders reference it).
  await sb
    .from("customers")
    .update({
      email: anonEmail,
      first_name: "Deleted",
      last_name: "User",
      phone: null,
      company_name: null
    })
    .eq("auth_user_id", v.id);

  // 2) Mark the profile disabled + scrub (in case auth delete is blocked).
  await sb
    .from("profiles")
    .update({ status: "disabled", full_name: "Deleted user", phone: null, email: anonEmail })
    .eq("id", v.id);

  // 3) Remove the sign-in. Cascades to the user's own business_applications;
  //    customers.auth_user_id is SET NULL so the customer + orders remain.
  let authDeleted = false;
  try {
    const { error } = await sb.auth.admin.deleteUser(v.id);
    authDeleted = !error;
  } catch {
    authDeleted = false;
  }

  return json({ ok: true, authDeleted, requestedAt: new Date(stamp).toISOString() });
}

// ---- Management: category create / update ----

function normalizeCategory(body: Record<string, unknown>) {
  const name = String(body.name ?? "").trim().slice(0, 120);
  const slug = String(body.slug ?? "").trim().toLowerCase().slice(0, 120);
  return { name, slug };
}

async function handleCategoryCreate(req: Request, env: Env) {
  const gate = await requireAdmin(req, env);
  if ("error" in gate && gate.error) return gate.error;
  if (!gate.viewer!.isStaff) return jsonErr("FORBIDDEN", "Staff required.", 403);
  const body = (await req.json()) as Record<string, unknown>;
  const { name, slug } = normalizeCategory(body);
  if (!name) return jsonErr("BAD_REQUEST", "Category name is required.");
  if (!/^[a-z0-9-]+$/.test(slug)) {
    return jsonErr("BAD_REQUEST", "Slug can use lowercase letters, numbers, and hyphens.");
  }
  const sb = admin(env);
  const { data, error } = await sb
    .from("categories")
    .insert({
      name,
      slug,
      parent_id: body.parentId ? String(body.parentId) : null,
      sort_order: Number.isFinite(Number(body.sortOrder)) ? Math.trunc(Number(body.sortOrder)) : 0,
      is_active: body.isActive === undefined ? true : Boolean(body.isActive),
      tax_category: body.taxCategory ? String(body.taxCategory).slice(0, 60) : null
    })
    .select("id")
    .single();
  if (error) return jsonErr("CREATE_FAILED", error.message);
  return json({ id: data?.id }, 201);
}

async function handleCategoryUpdate(req: Request, env: Env, id: string) {
  const gate = await requireAdmin(req, env);
  if ("error" in gate && gate.error) return gate.error;
  if (!gate.viewer!.isStaff) return jsonErr("FORBIDDEN", "Staff required.", 403);
  const body = (await req.json()) as Record<string, unknown>;
  const { name, slug } = normalizeCategory(body);
  if (!name) return jsonErr("BAD_REQUEST", "Category name is required.");
  if (!/^[a-z0-9-]+$/.test(slug)) {
    return jsonErr("BAD_REQUEST", "Slug can use lowercase letters, numbers, and hyphens.");
  }
  if (body.parentId && String(body.parentId) === id) {
    return jsonErr("BAD_REQUEST", "A category cannot be its own parent.");
  }
  const patch: Record<string, unknown> = { name, slug };
  if (body.parentId !== undefined) patch.parent_id = body.parentId ? String(body.parentId) : null;
  if (body.sortOrder !== undefined) patch.sort_order = Math.trunc(Number(body.sortOrder)) || 0;
  if (body.isActive !== undefined) patch.is_active = Boolean(body.isActive);
  if (body.taxCategory !== undefined) patch.tax_category = body.taxCategory ? String(body.taxCategory).slice(0, 60) : null;
  const sb = admin(env);
  const { error } = await sb.from("categories").update(patch).eq("id", id);
  if (error) return jsonErr("UPDATE_FAILED", error.message);
  return json({ ok: true });
}

async function handleCategoryDelete(req: Request, env: Env, id: string) {
  const gate = await requireAdmin(req, env);
  if ("error" in gate && gate.error) return gate.error;
  if (!gate.viewer!.isStaff) return jsonErr("FORBIDDEN", "Staff required.", 403);
  const sb = admin(env);
  // Products in a category block a hard delete (product_categories FK is RESTRICT)
  // — return a clear message instead of a raw DB error.
  const { count } = await sb
    .from("product_categories")
    .select("product_id", { count: "exact", head: true })
    .eq("category_id", id);
  if ((count ?? 0) > 0) {
    return jsonErr("CATEGORY_IN_USE", `Move or archive the ${count} product(s) in this category first.`);
  }
  const { error } = await sb.from("categories").delete().eq("id", id);
  if (error) return jsonErr("DELETE_FAILED", error.message);
  return json({ ok: true });
}

// ---- Management: customer create / update ----

function customerPatchFromBody(body: Record<string, unknown>) {
  const s = (k: string, max = 200) =>
    body[k] === undefined ? undefined : String(body[k] ?? "").trim().slice(0, max);
  const patch: Record<string, unknown> = {};
  const first = s("firstName", 120);
  const last = s("lastName", 120);
  const company = s("companyName", 160);
  const email = s("email", 200);
  const phone = s("phone", 40);
  const notes = s("notes", 2000);
  const customerType = s("customerType", 20);
  const status = s("status", 20);
  if (first !== undefined) patch.first_name = first || null;
  if (last !== undefined) patch.last_name = last || null;
  if (company !== undefined) patch.company_name = company || null;
  if (email !== undefined) patch.email = email || null;
  if (phone !== undefined) patch.phone = phone || null;
  if (notes !== undefined) patch.notes = notes || null;
  if (customerType !== undefined && customerType) patch.customer_type = customerType;
  if (status !== undefined && status) patch.status = status;
  return patch;
}

async function handleCustomerCreate(req: Request, env: Env) {
  const gate = await requireAdmin(req, env);
  if ("error" in gate && gate.error) return gate.error;
  const body = (await req.json()) as Record<string, unknown>;
  const patch = customerPatchFromBody(body);
  const name = [patch.first_name, patch.last_name].filter(Boolean).join(" ");
  if (!name && !patch.company_name && !patch.email) {
    return jsonErr("BAD_REQUEST", "Enter a name, company, or email.");
  }
  if (!patch.customer_type) patch.customer_type = "retail";
  if (!patch.status) patch.status = "active";
  const sb = admin(env);
  const { data, error } = await sb.from("customers").insert(patch).select("id").single();
  if (error) return jsonErr("CREATE_FAILED", error.message);
  return json({ id: data?.id }, 201);
}

async function handleCustomerUpdate(req: Request, env: Env, id: string) {
  const gate = await requireAdmin(req, env);
  if ("error" in gate && gate.error) return gate.error;
  const body = (await req.json()) as Record<string, unknown>;
  const patch = customerPatchFromBody(body);
  if (!Object.keys(patch).length) return jsonErr("BAD_REQUEST", "Nothing to update.");
  const sb = admin(env);
  const { error } = await sb.from("customers").update(patch).eq("id", id);
  if (error) return jsonErr("UPDATE_FAILED", error.message);
  return json({ ok: true });
}

// ---- Management: invoice detail + record payment ----

async function handleInvoiceDetail(req: Request, env: Env, id: string) {
  const gate = await requireAdmin(req, env);
  if ("error" in gate && gate.error) return gate.error;
  const sb = admin(env);
  const { data: inv, error } = await sb
    .from("invoices")
    .select(
      "id, invoice_number, status, issue_date, due_date, subtotal, discount_amount, tax_amount, shipping_amount, total_amount, amount_paid, balance_due, notes, customers ( company_name, first_name, last_name, email, phone )"
    )
    .eq("id", id)
    .maybeSingle();
  if (error) return jsonErr("LOAD_FAILED", error.message);
  if (!inv) return jsonErr("NOT_FOUND", "Invoice not found.", 404);
  const [{ data: items }, { data: payments }] = await Promise.all([
    sb
      .from("invoice_items")
      .select("id, product_name_snapshot, sku_snapshot, quantity, unit_price, line_total")
      .eq("invoice_id", id),
    sb
      .from("payments")
      .select("id, amount, payment_method, status, payment_kind, received_at, reference, notes")
      .eq("invoice_id", id)
      .order("created_at", { ascending: false })
  ]);
  const c = inv.customers as {
    company_name?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    email?: string | null;
    phone?: string | null;
  } | null;
  return json({
    invoice: {
      id: inv.id,
      number: inv.invoice_number,
      status: inv.status,
      issueDate: inv.issue_date,
      dueDate: inv.due_date,
      subtotal: num(inv.subtotal),
      discount: num(inv.discount_amount),
      tax: num(inv.tax_amount),
      shipping: num(inv.shipping_amount),
      total: num(inv.total_amount),
      paid: num(inv.amount_paid),
      balanceDue: num(inv.balance_due),
      notes: inv.notes,
      customer:
        c?.company_name ||
        [c?.first_name, c?.last_name].filter(Boolean).join(" ") ||
        "Customer",
      customerEmail: c?.email ?? null,
      customerPhone: c?.phone ?? null
    },
    items: (items ?? []).map((i) => ({
      id: i.id,
      name: i.product_name_snapshot,
      sku: i.sku_snapshot,
      quantity: num(i.quantity),
      unitPrice: num(i.unit_price),
      lineTotal: num(i.line_total)
    })),
    payments: (payments ?? []).map((p) => ({
      id: p.id,
      amount: num(p.amount),
      method: p.payment_method,
      status: p.status,
      kind: p.payment_kind,
      receivedAt: p.received_at,
      reference: p.reference,
      notes: p.notes
    }))
  });
}

async function handleInvoicePayment(req: Request, env: Env, id: string) {
  const gate = await requireAdmin(req, env);
  if ("error" in gate && gate.error) return gate.error;
  const body = (await req.json()) as {
    amount?: number;
    method?: string;
    reference?: string;
    notes?: string;
  };
  const sb = admin(env);
  const { data: inv } = await sb
    .from("invoices")
    .select("id, balance_due, status")
    .eq("id", id)
    .maybeSingle();
  if (!inv) return jsonErr("NOT_FOUND", "Invoice not found.", 404);
  if (inv.status === "void") return jsonErr("BAD_STATE", "This invoice is void.");
  const balance = num(inv.balance_due);
  let amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount <= 0) amount = balance; // default: pay full balance
  if (amount <= 0) return jsonErr("BAD_REQUEST", "Nothing left to pay on this invoice.");
  if (amount > balance + 0.001) return jsonErr("BAD_REQUEST", "Amount is more than the balance due.");

  // The payments trigger recomputes amount_paid + invoice status automatically.
  const { error } = await sb.from("payments").insert({
    invoice_id: id,
    payment_kind: "payment",
    status: "succeeded",
    amount: Math.round(amount * 100) / 100,
    currency: "USD",
    payment_method: String(body.method ?? "offline").slice(0, 40),
    reference: body.reference ? String(body.reference).slice(0, 120) : null,
    notes: body.notes ? String(body.notes).slice(0, 500) : null,
    received_at: new Date().toISOString(),
    created_by: gate.viewer!.id
  });
  if (error) return jsonErr("PAYMENT_FAILED", error.message);
  const { data: after } = await sb
    .from("invoices")
    .select("amount_paid, balance_due, status")
    .eq("id", id)
    .maybeSingle();
  return json({
    ok: true,
    paid: num(after?.amount_paid),
    balanceDue: num(after?.balance_due),
    status: after?.status
  });
}

// ---- Management: product image upload (public R2 bucket) ----

async function handleProductMediaUpload(req: Request, env: Env, productId: string) {
  const gate = await requireAdmin(req, env);
  if ("error" in gate && gate.error) return gate.error;
  if (!gate.viewer!.isManager) return jsonErr("FORBIDDEN", "Manager required to add product images.", 403);
  const body = (await req.json()) as { base64?: string; filename?: string; altText?: string };
  if (!body.base64) return jsonErr("BAD_REQUEST", "No image data.");
  const sb = admin(env);
  const { count } = await sb
    .from("product_media")
    .select("id", { count: "exact", head: true })
    .eq("product_id", productId)
    .eq("media_type", "image");
  const existing = count ?? 0;
  if (existing >= 10) return jsonErr("IMAGE_LIMIT_REACHED", "A product can have at most 10 images.");

  const uploaded = await uploadProductImageR2(env, productId, body.base64, String(body.filename ?? "image.jpg"));
  if ("error" in uploaded) return jsonErr("UPLOAD_FAILED", uploaded.error);

  const { data, error } = await sb
    .rpc("admin_complete_product_image", {
      p_product_id: productId,
      p_object_key: uploaded.key,
      p_public_url: uploaded.publicUrl,
      p_content_type: uploaded.mime,
      p_bytes: uploaded.bytes,
      p_width: null,
      p_height: null,
      p_alt_text: String(body.altText ?? "").slice(0, 240),
      p_position: existing + 1,
      p_is_primary: existing === 0,
      p_created_by: gate.viewer!.id
    })
    .single();
  if (error) return jsonErr("DB_ERROR", error.message);
  await writeMobileAudit(sb, gate.viewer!, {
    action: "product.media_upload",
    entityType: "product",
    entityId: productId,
    after: { filename: String(body.filename ?? "image.jpg"), mediaType: "image" }
  });
  return json({ media: data, publicUrl: uploaded.publicUrl }, 201);
}

async function handleProductMediaList(req: Request, env: Env, productId: string) {
  const gate = await requireAdmin(req, env);
  if ("error" in gate && gate.error) return gate.error;
  const sb = admin(env);
  const { data, error } = await sb
    .from("product_media")
    .select("id, media_type, provider, status, object_key, public_url, stream_uid, poster_url, position, is_primary")
    .eq("product_id", productId)
    .order("media_type", { ascending: true })
    .order("position", { ascending: true });
  if (error) return jsonErr("LOAD_FAILED", error.message);
  return json({
    media: (data ?? []).map((m) => ({
      id: m.id,
      mediaType: m.media_type,
      provider: m.provider,
      status: m.status,
      url:
        m.public_url ??
        (m.provider === "r2" && m.object_key ? r2PublicUrl(env, m.object_key) : null),
      streamUid: m.stream_uid,
      posterUrl: m.poster_url,
      position: m.position,
      isPrimary: m.is_primary
    }))
  });
}

async function handleProductMediaDelete(req: Request, env: Env, productId: string, mediaId: string) {
  const gate = await requireAdmin(req, env);
  if ("error" in gate && gate.error) return gate.error;
  if (!gate.viewer!.isManager) return jsonErr("FORBIDDEN", "Manager required.", 403);
  const sb = admin(env);
  const { data: m } = await sb
    .from("product_media")
    .select("id, object_key, provider")
    .eq("id", mediaId)
    .eq("product_id", productId)
    .maybeSingle();
  if (!m) return jsonErr("NOT_FOUND", "Media not found.", 404);
  const { error } = await sb.from("product_media").delete().eq("id", mediaId);
  if (error) return jsonErr("DELETE_FAILED", error.message);
  // Best-effort: remove the underlying R2 object so storage doesn't leak.
  if (m.provider === "r2" && m.object_key) {
    try {
      await deleteR2Object(env, m.object_key);
    } catch {
      /* ignore — the DB row is already gone */
    }
  }
  await writeMobileAudit(sb, gate.viewer!, {
    action: "product.media_delete",
    entityType: "product",
    entityId: productId,
    after: { mediaId, provider: m.provider }
  });
  return json({ ok: true });
}

async function deleteR2Object(env: Env, key: string): Promise<void> {
  if (
    !env.CLOUDFLARE_ACCOUNT_ID ||
    !env.R2_ACCESS_KEY_ID ||
    !env.R2_SECRET_ACCESS_KEY ||
    !env.R2_BUCKET
  ) {
    return;
  }
  const { AwsClient } = await import("aws4fetch");
  const client = new AwsClient({
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    service: "s3",
    region: "auto"
  });
  const url = `https://${env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com/${env.R2_BUCKET}/${key}`;
  await client.fetch(url, { method: "DELETE" });
}

async function uploadProductImageR2(
  env: Env,
  productId: string,
  base64: string,
  filename: string
): Promise<{ key: string; publicUrl: string; mime: string; bytes: number } | { error: string }> {
  if (
    !env.CLOUDFLARE_ACCOUNT_ID ||
    !env.R2_ACCESS_KEY_ID ||
    !env.R2_SECRET_ACCESS_KEY ||
    !env.R2_BUCKET ||
    !env.R2_PUBLIC_BASE_URL
  ) {
    return {
      error: "Product image storage is not configured on the mobile-api worker (set R2_BUCKET and R2_PUBLIC_BASE_URL)."
    };
  }
  const cleaned = base64.replace(/^data:[^;]+;base64,/, "");
  let binary: Uint8Array;
  try {
    const raw = atob(cleaned);
    binary = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) binary[i] = raw.charCodeAt(i);
  } catch {
    return { error: "Invalid image encoding." };
  }
  if (binary.byteLength <= 0) return { error: "Empty image." };
  if (binary.byteLength > 8 * 1024 * 1024) return { error: "Image larger than 8 MB." };
  const detected = detectProofType(binary);
  if (!detected || detected.extension === "pdf") {
    return { error: "Use a JPEG, PNG, or WebP image." };
  }
  const safeBase = filename
    .replace(/\.[^.]*$/, "")
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "image";
  const key = `products/${productId}/images/${crypto.randomUUID()}-${safeBase}.${detected.extension}`;

  const { AwsClient } = await import("aws4fetch");
  const client = new AwsClient({
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY
  });
  const url = `https://${env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com/${env.R2_BUCKET}/${key}`;
  const res = await client.fetch(url, {
    method: "PUT",
    headers: {
      "Content-Type": detected.contentType,
      "Cache-Control": "public, max-age=31536000, immutable"
    },
    body: binary
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return { error: `Image upload failed (${res.status}): ${text.slice(0, 160)}` };
  }
  const base = env.R2_PUBLIC_BASE_URL.replace(/\/$/, "");
  const publicUrl = `${base}/${key.split("/").map(encodeURIComponent).join("/")}`;
  return { key, publicUrl, mime: detected.contentType, bytes: binary.byteLength };
}

// ---- Management: product video stored in R2 (no Cloudflare Stream needed) ----
// Free path: presign a PUT straight to the same public R2 bucket as images, the
// app uploads the file directly (streamed from disk), then /complete records a
// product_media row (provider=r2, media_type=video). Served from R2_PUBLIC_BASE_URL.

const VIDEO_EXTS: Record<string, string> = {
  mp4: "video/mp4",
  mov: "video/quicktime",
  m4v: "video/x-m4v",
  webm: "video/webm"
};

function r2Configured(env: Env): boolean {
  return Boolean(
    env.CLOUDFLARE_ACCOUNT_ID &&
      env.R2_ACCESS_KEY_ID &&
      env.R2_SECRET_ACCESS_KEY &&
      env.R2_BUCKET &&
      env.R2_PUBLIC_BASE_URL
  );
}

function r2PublicUrl(env: Env, key: string): string {
  const base = env.R2_PUBLIC_BASE_URL!.replace(/\/$/, "");
  return `${base}/${key.split("/").map(encodeURIComponent).join("/")}`;
}

async function handleProductVideoPresign(req: Request, env: Env, productId: string) {
  const gate = await requireAdmin(req, env);
  if ("error" in gate && gate.error) return gate.error;
  if (!gate.viewer!.isManager) return jsonErr("FORBIDDEN", "Manager required to add product video.", 403);
  if (!r2Configured(env)) {
    return jsonErr("R2_NOT_CONFIGURED", "Video storage is not configured (set R2_BUCKET + R2_PUBLIC_BASE_URL).");
  }
  const body = (await req.json()) as { filename?: string };
  const rawExt = String(body.filename ?? "video.mp4").split(".").pop()?.toLowerCase() ?? "mp4";
  const ext = VIDEO_EXTS[rawExt] ? rawExt : "mp4";
  const contentType = VIDEO_EXTS[ext];

  const sb = admin(env);
  const { count } = await sb
    .from("product_media")
    .select("id", { count: "exact", head: true })
    .eq("product_id", productId)
    .eq("media_type", "video");
  if ((count ?? 0) >= 1) {
    return jsonErr("VIDEO_LIMIT_REACHED", "Remove or replace the existing product video first.");
  }

  const key = `products/${productId}/videos/${crypto.randomUUID()}.${ext}`;
  const { AwsClient } = await import("aws4fetch");
  const client = new AwsClient({
    accessKeyId: env.R2_ACCESS_KEY_ID!,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY!,
    service: "s3",
    region: "auto"
  });
  const url = new URL(`https://${env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com/${env.R2_BUCKET}/${key}`);
  url.searchParams.set("X-Amz-Expires", "3600");
  const signed = await client.sign(url.toString(), { method: "PUT", aws: { signQuery: true } });

  return json({
    uploadUrl: signed.url,
    key,
    publicUrl: r2PublicUrl(env, key),
    contentType
  });
}

async function handleProductVideoComplete(req: Request, env: Env, productId: string) {
  const gate = await requireAdmin(req, env);
  if ("error" in gate && gate.error) return gate.error;
  if (!gate.viewer!.isManager) return jsonErr("FORBIDDEN", "Manager required.", 403);
  const body = (await req.json()) as {
    key?: string;
    contentType?: string;
    bytes?: number;
    filename?: string;
  };
  const key = String(body.key ?? "");
  if (!key.startsWith(`products/${productId}/videos/`)) {
    return jsonErr("BAD_REQUEST", "The object key does not belong to this product.");
  }
  const sb = admin(env);
  const { data: media, error } = await sb
    .from("product_media")
    .insert({
      product_id: productId,
      media_type: "video",
      provider: "r2",
      status: "ready",
      object_key: key,
      public_url: r2PublicUrl(env, key),
      content_type: String(body.contentType ?? "video/mp4").slice(0, 120),
      bytes: Number.isFinite(Number(body.bytes)) ? Math.trunc(Number(body.bytes)) : null,
      alt_text: `${String(body.filename ?? "product").slice(0, 120)} product video`,
      position: 1,
      created_by: gate.viewer!.id
    })
    .select("id, public_url, status")
    .single();
  if (error) return jsonErr("DB_ERROR", error.message);
  await writeMobileAudit(sb, gate.viewer!, {
    action: "product.video_upload",
    entityType: "product",
    entityId: productId,
    after: { filename: String(body.filename ?? "product video"), mediaType: "video" }
  });
  return json({ media, publicUrl: r2PublicUrl(env, key) }, 201);
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

async function writeMobileAudit(
  sb: SupabaseClient,
  viewer: Viewer,
  input: {
    action: string;
    entityType: string;
    entityId: string;
    before?: unknown;
    after?: unknown;
    metadata?: Record<string, unknown>;
  }
) {
  const { error } = await sb.from("audit_log").insert({
    actor_user_id: viewer.id,
    action: input.action,
    entity_type: input.entityType,
    entity_id: input.entityId,
    before_data: input.before ?? null,
    after_data: input.after ?? null,
    metadata: {
      source: "mobile",
      actorName: viewer.fullName || viewer.email || viewer.id.slice(0, 8),
      actorEmail: viewer.email,
      actorRole: viewer.role,
      ...(input.metadata ?? {})
    }
  });
  if (error) console.error("[mobile audit]", error.message, input.action, input.entityId);
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

type OrderEmailContext = {
  id: string;
  order_number: string | null;
  customer_id: string;
};

async function orderEmailRecipient(sb: SupabaseClient, customerId: string) {
  const { data: customer } = await sb
    .from("customers")
    .select("auth_user_id, email, first_name, last_name, company_name")
    .eq("id", customerId)
    .maybeSingle();
  if (!customer) return null;
  let email = String(customer.email ?? "").trim();
  if (customer.auth_user_id) {
    const { data: profile } = await sb
      .from("profiles")
      .select("email")
      .eq("id", customer.auth_user_id)
      .maybeSingle();
    const loginEmail = String(profile?.email ?? "").trim();
    if (loginEmail) email = loginEmail;
  }
  if (!email) return null;
  const name = [customer.first_name, customer.last_name].filter(Boolean).join(" ") ||
    customer.company_name ||
    "Customer";
  return { email, name: String(name) };
}

async function sendOrderPaymentStatusEmail(env: Env, sb: SupabaseClient, order: OrderEmailContext) {
  const [{ data: invoice }, recipient] = await Promise.all([
    sb
      .from("invoices")
      .select("invoice_number, status, total_amount, amount_paid, balance_due")
      .eq("order_id", order.id)
      .maybeSingle(),
    orderEmailRecipient(sb, order.customer_id)
  ]);
  if (!invoice) return { sent: false, error: "This order does not have an invoice." };
  if (!recipient) return { sent: false, error: "The customer does not have an email address." };

  const orderNumber = order.order_number || order.id.slice(0, 8).toUpperCase();
  const orderUrl = customerOrderUrl(order.order_number, order.id);
  const balance = num(invoice.balance_due);
  const isPaid = invoice.status === "paid" || balance <= 0;
  const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
  const subject = isPaid
    ? `Payment received for order ${orderNumber}`
    : `Payment reminder for order ${orderNumber}`;
  const statusText = isPaid
    ? `We received your payment for invoice ${invoice.invoice_number}. Thank you.`
    : `Invoice ${invoice.invoice_number} has an outstanding balance of ${money.format(balance)}. Please complete payment.`;
  return sendMobileEmail(env, {
    to: recipient.email,
    subject,
    text: `Hello ${recipient.name},\n\n${statusText}\n\nView order ${orderNumber}: ${orderUrl}\n\nVinameals Supplies`,
    html: `<p>Hello ${escapeEmailHtml(recipient.name)},</p><p>${escapeEmailHtml(statusText)}</p><p><a href="${orderUrl}">View order ${escapeEmailHtml(orderNumber)}</a></p><p>Vinameals Supplies</p>`
  });
}

async function sendOrderShipmentEmail(
  env: Env,
  sb: SupabaseClient,
  order: OrderEmailContext,
  carrier: string,
  tracking: string | null
) {
  const recipient = await orderEmailRecipient(sb, order.customer_id);
  if (!recipient) return { sent: false, error: "The customer does not have an email address." };
  const orderNumber = order.order_number || order.id.slice(0, 8).toUpperCase();
  const orderUrl = customerOrderUrl(order.order_number, order.id);
  const trackingUrl = tracking ? trackingUrlFor(carrier, tracking) : null;
  const trackingText = tracking
    ? `\nTracking: ${tracking}${trackingUrl ? `\nTrack package: ${trackingUrl}` : ""}`
    : "";
  return sendMobileEmail(env, {
    to: recipient.email,
    subject: `Order ${orderNumber} has shipped`,
    text: `Hello ${recipient.name},\n\nYour Vinameals order ${orderNumber} has shipped.${trackingText}\n\nView your order: ${orderUrl}\n\nVinameals Supplies`,
    html: `<p>Hello ${escapeEmailHtml(recipient.name)},</p><p>Your Vinameals order <strong>${escapeEmailHtml(orderNumber)}</strong> has shipped.</p>${tracking ? `<p><strong>Tracking:</strong> ${escapeEmailHtml(tracking)}${trackingUrl ? `<br><a href="${trackingUrl}">Track your package</a>` : ""}</p>` : ""}<p><a href="${orderUrl}">View order ${escapeEmailHtml(orderNumber)}</a></p><p>Vinameals Supplies</p>`
  });
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
    proofBase64?: string;
    proofFilename?: string;
    proofContentType?: string;
  };
  const action = body.action ?? "";
  const sb = admin(env);
  const now = new Date().toISOString();

  const { data: order } = await sb
    .from("sales_orders")
    .select(
      "id, order_number, customer_id, status, fulfillment_method, pickup_ready_at, picked_up_at, shipping_address_snapshot"
    )
    .eq("id", orderId)
    .maybeSingle();
  if (!order) return jsonErr("NOT_FOUND", "Order not found.", 404);
  const orderEmailContext: OrderEmailContext = {
    id: order.id,
    order_number: order.order_number,
    customer_id: order.customer_id
  };
  let responseMessage = "Order updated.";

  if (action === "mark_pickup_ready") {
    await sb
      .from("sales_orders")
      .update({ pickup_ready_at: now, updated_at: now })
      .eq("id", orderId);
    responseMessage = "Order marked ready for pickup.";
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
    responseMessage = "Pickup confirmed.";
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
    responseMessage = "Order cancelled.";
  } else if (action === "confirm_delivered" || action === "save_tracking") {
    const tracking = (body.trackingNumber ?? "").trim().slice(0, 80);
    const carrier = (body.carrier ?? "other").trim().toLowerCase();
    const proofBase64 = typeof body.proofBase64 === "string" ? body.proofBase64 : "";
    const proofFilename = String(body.proofFilename ?? "shipping-proof").slice(0, 200);
    const proofContentType = String(body.proofContentType ?? "").slice(0, 120);

    const { data: beforeShip } = await sb
      .from("sales_orders")
      .select("tracking_number, shipping_proof_object_key, status, fulfillment_method, shipping_address_snapshot")
      .eq("id", orderId)
      .maybeSingle();

    if (beforeShip?.fulfillment_method !== "ship") {
      return jsonErr("NOT_SHIPPING_ORDER", "This is not a shipping order.");
    }
    if (action === "confirm_delivered" && beforeShip.status !== "confirmed") {
      return jsonErr("BAD_STATE", "Only a confirmed order can be marked shipped.");
    }
    if (action === "confirm_delivered" && !beforeShip.shipping_address_snapshot) {
      return jsonErr("SHIPPING_ADDRESS_REQUIRED", "A shipping address is required before confirming shipment.");
    }

    let proofKey: string | null = null;
    if (proofBase64) {
      const uploaded = await uploadShippingProofR2(env, orderId, proofBase64, proofFilename, proofContentType);
      if ("error" in uploaded) return jsonErr("PROOF_UPLOAD_FAILED", uploaded.error);
      proofKey = uploaded.key;
    }

    const hasTracking = Boolean(tracking || beforeShip?.tracking_number);
    const hasProof = Boolean(proofKey || beforeShip?.shipping_proof_object_key);
    if (!hasTracking && !hasProof) {
      return jsonErr(
        "SHIP_PROOF_REQUIRED",
        "Nhập mã tracking hoặc tải lên PDF/ảnh chứng từ ship."
      );
    }

    const patch: Record<string, unknown> = {
      shipping_carrier: carrier,
      updated_at: now,
      shipped_at: now
    };
    const effectiveTracking = tracking || beforeShip?.tracking_number || null;
    if (tracking) patch.tracking_number = tracking;
    if (effectiveTracking) patch.tracking_url = trackingUrlFor(carrier, effectiveTracking);
    if (proofKey) {
      patch.shipping_proof_object_key = proofKey;
      patch.shipping_proof_filename = proofFilename;
      patch.shipping_proof_content_type = proofContentType || "application/octet-stream";
    }
    if (action === "confirm_delivered") {
      patch.status = "fulfilled";
      patch.fulfilled_at = now;
    }
    const { error: shipErr } = await sb.from("sales_orders").update(patch).eq("id", orderId);
    if (shipErr) return jsonErr("UPDATE_FAILED", shipErr.message);
    if (action === "confirm_delivered") {
      const email = await sendOrderShipmentEmail(env, sb, orderEmailContext, carrier, effectiveTracking);
      responseMessage = email.sent
        ? "Shipment confirmed and the customer was emailed."
        : `Shipment confirmed, but email could not be sent: ${email.error}`;
    } else {
      responseMessage = "Shipping details saved.";
    }
  } else if (action === "update_notes") {
    await sb
      .from("sales_orders")
      .update({ notes: (body.note ?? "").slice(0, 1000), updated_at: now })
      .eq("id", orderId);
    responseMessage = "Notes saved.";
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
    const email = await sendOrderPaymentStatusEmail(env, sb, orderEmailContext);
    responseMessage = email.sent
      ? "Payment confirmed and the customer was emailed."
      : `Payment confirmed, but email could not be sent: ${email.error}`;
  } else if (action === "send_order_email") {
    const email = await sendOrderPaymentStatusEmail(env, sb, orderEmailContext);
    if (!email.sent) return jsonErr("EMAIL_FAILED", email.error || "Email could not be sent.");
    responseMessage = "The order email was sent to the customer.";
  } else {
    return jsonErr("BAD_REQUEST", `Unknown action: ${action}`);
  }

  await writeMobileAudit(sb, viewer, {
    action: `order.${action}`,
    entityType: "sales_order",
    entityId: orderId,
    before: {
      status: order.status,
      fulfillmentMethod: order.fulfillment_method,
      pickupReadyAt: order.pickup_ready_at,
      pickedUpAt: order.picked_up_at
    },
    after: {
      note: body.note?.slice(0, 1000) || null,
      reason: body.reason?.slice(0, 500) || null,
      carrier: body.carrier?.slice(0, 40) || null,
      trackingNumber: body.trackingNumber?.slice(0, 80) || null,
      proofFilename: body.proofFilename?.slice(0, 200) || null
    },
    metadata: {
      orderNumber: order.order_number,
      message: responseMessage,
      note: body.note?.slice(0, 1000) || null,
      reason: body.reason?.slice(0, 500) || null
    }
  });

  return json({ ok: true, action, message: responseMessage });
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
  await writeMobileAudit(sb, viewer, {
    action: "inventory.adjust",
    entityType: "product_variant",
    entityId: variantId,
    before: { onHand: current },
    after: { delta, mode: body.mode ?? "delta", reason, locationId },
    metadata: { sku: body.sku ?? "", reason }
  });
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
    .select("id, created_at, movement_type, quantity_change, reason, created_by")
    .eq("variant_id", variantId)
    .eq("location_id", locationId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) return jsonErr("LOAD_FAILED", error.message);
  const actorIds = Array.from(
    new Set((data ?? []).map((movement) => movement.created_by).filter((id): id is string => Boolean(id)))
  );
  const actorById = new Map<string, { full_name: string | null; email: string | null }>();
  if (actorIds.length) {
    const { data: profiles } = await sb
      .from("profiles")
      .select("id, full_name, email")
      .in("id", actorIds);
    for (const profile of profiles ?? []) actorById.set(profile.id, profile);
  }
  return json({
    movements: (data ?? []).map((m) => {
      const actor = m.created_by ? actorById.get(m.created_by) : null;
      return {
        id: m.id,
        createdAt: m.created_at,
        movementType: m.movement_type,
        quantityChange: num(m.quantity_change),
        reason: m.reason,
        sku: "",
        productName: "",
        changedBy: actor?.full_name || actor?.email || "System"
      };
    })
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

async function handleProductSalesReport(req: Request, env: Env, productId: string, url: URL) {
  const gate = await requireAdmin(req, env);
  if ("error" in gate && gate.error) return gate.error;

  const fromValue = url.searchParams.get("from");
  const toValue = url.searchParams.get("to");
  const grain = url.searchParams.get("grain") ?? "day";
  if (!fromValue || !toValue || !["hour", "day", "month"].includes(grain)) {
    return jsonErr("BAD_REQUEST", "from, to and a valid grain are required.", 400);
  }

  const from = new Date(fromValue);
  const to = new Date(toValue);
  const maximumRangeMs = 371 * 24 * 60 * 60 * 1000;
  if (
    Number.isNaN(from.getTime()) ||
    Number.isNaN(to.getTime()) ||
    to <= from ||
    to.getTime() - from.getTime() > maximumRangeMs
  ) {
    return jsonErr("BAD_REQUEST", "Choose a valid range of no more than 371 days.", 400);
  }

  const sb = admin(env);
  const { data: product, error: productError } = await sb
    .from("products")
    .select("id, name, product_variants ( sku, is_default )")
    .eq("id", productId)
    .maybeSingle();
  if (productError) return jsonErr("LOAD_FAILED", productError.message);
  if (!product) return jsonErr("NOT_FOUND", "Product not found.", 404);

  const { data: orders, error: orderError } = await sb
    .from("sales_orders")
    .select("id, created_at")
    .in("status", ["confirmed", "fulfilled"])
    .gte("created_at", from.toISOString())
    .lt("created_at", to.toISOString())
    .order("created_at", { ascending: true })
    .limit(10000);
  if (orderError) return jsonErr("LOAD_FAILED", orderError.message);

  type ReportOrder = { id: string; created_at: string };
  type ReportItem = {
    order_id: string;
    quantity: unknown;
    line_subtotal: unknown;
    discount_amount: unknown;
  };
  const orderRows = (orders ?? []) as ReportOrder[];
  const orderDateById = new Map(orderRows.map((order) => [order.id, order.created_at]));
  const itemRows: ReportItem[] = [];
  const chunkSize = 200;
  for (let index = 0; index < orderRows.length; index += chunkSize) {
    const orderIds = orderRows.slice(index, index + chunkSize).map((order) => order.id);
    const { data: items, error: itemError } = await sb
      .from("sales_order_items")
      .select("order_id, quantity, line_subtotal, discount_amount")
      .eq("product_id", productId)
      .in("order_id", orderIds)
      .limit(10000);
    if (itemError) return jsonErr("LOAD_FAILED", itemError.message);
    itemRows.push(...((items ?? []) as ReportItem[]));
  }

  const reportTimeZone = "America/Los_Angeles";
  const bucketFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: reportTimeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23"
  });
  const labelFormatters = {
    hour: new Intl.DateTimeFormat("en-US", { timeZone: reportTimeZone, hour: "numeric" }),
    day: new Intl.DateTimeFormat("en-US", { timeZone: reportTimeZone, month: "short", day: "numeric" }),
    month: new Intl.DateTimeFormat("en-US", { timeZone: reportTimeZone, month: "short" })
  };
  const bucketFor = (value: string) => {
    const date = new Date(value);
    const parts = Object.fromEntries(
      bucketFormatter.formatToParts(date).map((part) => [part.type, part.value])
    );
    const key = grain === "hour"
      ? `${parts.year}-${parts.month}-${parts.day}-${parts.hour}`
      : grain === "month"
        ? `${parts.year}-${parts.month}`
        : `${parts.year}-${parts.month}-${parts.day}`;
    return {
      key,
      label: labelFormatters[grain as keyof typeof labelFormatters].format(date)
    };
  };

  type Bucket = {
    key: string;
    label: string;
    unitsSold: number;
    revenue: number;
    orderIds: Set<string>;
  };
  const buckets = new Map<string, Bucket>();
  const allOrderIds = new Set<string>();
  let unitsSold = 0;
  let revenue = 0;
  for (const item of itemRows) {
    const orderDate = orderDateById.get(item.order_id);
    if (!orderDate) continue;
    const units = num(item.quantity);
    const itemRevenue = Math.max(0, num(item.line_subtotal) - num(item.discount_amount));
    const bucketInfo = bucketFor(orderDate);
    const bucket = buckets.get(bucketInfo.key) ?? {
      ...bucketInfo,
      unitsSold: 0,
      revenue: 0,
      orderIds: new Set<string>()
    };
    bucket.unitsSold += units;
    bucket.revenue += itemRevenue;
    bucket.orderIds.add(item.order_id);
    buckets.set(bucket.key, bucket);
    allOrderIds.add(item.order_id);
    unitsSold += units;
    revenue += itemRevenue;
  }

  const round = (value: number) => Math.round(value * 100) / 100;
  const points = Array.from(buckets.values())
    .sort((a, b) => a.key.localeCompare(b.key))
    .map((bucket) => ({
      key: bucket.key,
      label: bucket.label,
      unitsSold: round(bucket.unitsSold),
      revenue: round(bucket.revenue),
      orderCount: bucket.orderIds.size
    }));
  const bestPeriod = points.reduce<(typeof points)[number] | null>((best, point) => {
    if (!best || point.unitsSold > best.unitsSold) return point;
    if (point.unitsSold === best.unitsSold && point.revenue > best.revenue) return point;
    return best;
  }, null);

  const rawVariants = (product as { product_variants?: unknown }).product_variants;
  const variants = (Array.isArray(rawVariants) ? rawVariants : []) as { sku: string; is_default: boolean }[];
  const variant = variants.find((item) => item.is_default) ?? variants[0];
  return json({
    product: { id: product.id, name: product.name, sku: variant?.sku ?? null },
    range: { from: from.toISOString(), to: to.toISOString(), grain, timeZone: reportTimeZone },
    summary: {
      unitsSold: round(unitsSold),
      revenue: round(revenue),
      orderCount: allOrderIds.size,
      averageUnitsPerOrder: allOrderIds.size ? round(unitsSold / allOrderIds.size) : 0
    },
    bestPeriod,
    points
  });
}

async function handleProductStatus(req: Request, env: Env, id: string) {
  const gate = await requireAdmin(req, env);
  if ("error" in gate && gate.error) return gate.error;
  const viewer = gate.viewer!;
  const body = (await req.json()) as { action?: string };
  const action = body.action ?? "";
  const sb = admin(env);
  if (action === "archive") {
    await sb.from("products").update({ status: "archived", featured: false }).eq("id", id);
    await writeMobileAudit(sb, viewer, {
      action: "product.archive",
      entityType: "product",
      entityId: id,
      after: { status: "archived", featured: false }
    });
    return json({ message: "Archived." });
  }
  if (action === "restore") {
    await sb
      .from("products")
      .update({ status: "active", published_at: new Date().toISOString() })
      .eq("id", id);
    await writeMobileAudit(sb, viewer, {
      action: "product.restore",
      entityType: "product",
      entityId: id,
      after: { status: "active" }
    });
    return json({ message: "Restored." });
  }
  if (action === "delete_forever") {
    if (!gate.viewer!.isAdmin) return jsonErr("FORBIDDEN", "Admin only.", 403);
    const { error } = await sb.rpc("admin_delete_product_forever", { p_product_id: id });
    if (error) return jsonErr("DELETE_FAILED", error.message);
    await writeMobileAudit(sb, viewer, {
      action: "product.delete_forever",
      entityType: "product",
      entityId: id
    });
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

function applicationDisplayValue(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return String(value);
  if (Array.isArray(value)) {
    const items = value.map(applicationDisplayValue).filter((item): item is string => Boolean(item));
    return items.length ? items.join(", ") : null;
  }
  if (typeof value === "object") {
    const address = value as Record<string, unknown>;
    const parts = [
      address.recipientName ?? address.recipient_name,
      address.companyName ?? address.company_name,
      address.line1 ?? address.street,
      address.line2,
      [address.city, address.state ?? address.stateRegion ?? address.state_region, address.postalCode ?? address.postal_code ?? address.zip]
        .filter(Boolean)
        .join(" "),
      address.country ?? address.countryCode ?? address.country_code
    ]
      .map(applicationDisplayValue)
      .filter((item): item is string => Boolean(item));
    return parts.length ? parts.join(", ") : JSON.stringify(value);
  }
  return String(value);
}

function applicationRows(
  source: Record<string, unknown>,
  fields: Array<[string, string]>
) {
  return fields
    .map(([key, label]) => ({ label, value: applicationDisplayValue(source[key]) }))
    .filter((row): row is { label: string; value: string } => Boolean(row.value));
}

async function signedPrivateDocumentUrl(env: Env, objectKey: string): Promise<string | null> {
  if (
    !env.CLOUDFLARE_ACCOUNT_ID ||
    !env.R2_ACCESS_KEY_ID ||
    !env.R2_SECRET_ACCESS_KEY ||
    !env.R2_DOCUMENTS_BUCKET
  ) {
    return null;
  }
  try {
    const { AwsClient } = await import("aws4fetch");
    const client = new AwsClient({
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
      service: "s3",
      region: "auto"
    });
    const encodedKey = objectKey.split("/").map(encodeURIComponent).join("/");
    const url = `https://${env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com/${env.R2_DOCUMENTS_BUCKET}/${encodedKey}?X-Amz-Expires=900`;
    const request = await client.sign(url, { method: "GET", aws: { signQuery: true } });
    return request.url;
  } catch {
    return null;
  }
}

async function handleApplicationDetail(req: Request, env: Env, type: string, id: string) {
  const v = await getViewer(req, env);
  if (!v) return jsonErr("UNAUTHORIZED", "Sign in required.", 401);
  if (!v.isManager) return jsonErr("FORBIDDEN", "Manager required.", 403);
  const sb = admin(env);

  if (type === "tax_exemption") {
    const { data, error } = await sb
      .from("tax_exemption_applications")
      .select(
        `id, customer_id, contact_name, business_name, email, phone, status, review_note,
         reviewed_at, created_at,
         tax_exemption_documents ( id, object_key, content_type, bytes, original_filename )`
      )
      .eq("id", id)
      .maybeSingle();
    if (error) return jsonErr("LOAD_FAILED", error.message);
    if (!data) return jsonErr("NOT_FOUND", "Application not found.", 404);

    const row = data as unknown as Record<string, unknown>;
    const rawDocuments = Array.isArray(row.tax_exemption_documents)
      ? (row.tax_exemption_documents as Record<string, unknown>[])
      : [];
    const documents = await Promise.all(
      rawDocuments.map(async (doc) => ({
        id: String(doc.id),
        name: applicationDisplayValue(doc.original_filename) || "Tax exemption document",
        type: applicationDisplayValue(doc.content_type) || "Document",
        size: num(doc.bytes),
        url: await signedPrivateDocumentUrl(env, String(doc.object_key ?? ""))
      }))
    );
    return json({
      application: {
        id: String(row.id),
        type,
        title: applicationDisplayValue(row.business_name) || "Tax exemption application",
        number: String(row.id).slice(0, 8).toUpperCase(),
        email: applicationDisplayValue(row.email),
        status: applicationDisplayValue(row.status),
        wholesaleRequested: false,
        taxRequested: true,
        sections: [
          {
            title: "Applicant",
            rows: applicationRows(row, [
              ["contact_name", "Contact name"],
              ["business_name", "Business name"],
              ["email", "Email"],
              ["phone", "Phone"]
            ])
          },
          {
            title: "Review",
            rows: applicationRows(row, [
              ["status", "Status"],
              ["review_note", "Decision reason"],
              ["reviewed_at", "Reviewed at"],
              ["created_at", "Submitted at"]
            ])
          }
        ].filter((section) => section.rows.length),
        documents
      }
    });
  }

  if (type !== "business") return jsonErr("BAD_REQUEST", "Unknown application type.");
  const { data, error } = await sb
    .from("business_applications")
    .select(
      `id, application_number, customer_id, applicant_full_name, applicant_job_title,
       applicant_email, applicant_phone, preferred_contact_method, legal_business_name, dba_name,
       entity_type, business_category, business_description, website_url, social_media_url,
       years_in_business, estimated_monthly_volume, business_street, business_address_line_2,
       business_city, business_state, business_zip, business_country, mailing_same_as_business,
       mailing_address_json, shipping_same_as_business, shipping_address_json, wholesale_requested,
       tax_exemption_requested, wholesale_status, tax_exemption_status, products_interested_json,
       intended_use, sales_channels_json, expected_first_order_amount, wholesale_notes, exemption_type,
       issuing_state, permit_number, certificate_effective_date, certificate_expiration_date,
       certificate_business_name, certificate_same_as_business, certificate_address_json,
       resale_product_description, no_permit_reason, verification_reference, signer_name, signer_title,
       electronic_signature, signed_at, submitted_at, risk_flag, internal_notes,
       customer_visible_message, wholesale_decided_at, wholesale_decision_reason, tax_decided_at,
       tax_decision_reason, tax_verification_source, tax_verification_date, created_at, updated_at,
       application_documents ( id, document_type, original_filename, storage_path, mime_type, file_size, uploaded_at, status, admin_note )`
    )
    .eq("id", id)
    .maybeSingle();
  if (error) return jsonErr("LOAD_FAILED", error.message);
  if (!data) return jsonErr("NOT_FOUND", "Application not found.", 404);

  const row = data as unknown as Record<string, unknown>;
  const rawDocuments = Array.isArray(row.application_documents)
    ? (row.application_documents as Record<string, unknown>[])
    : [];
  const documents = await Promise.all(
    rawDocuments.map(async (doc) => ({
      id: String(doc.id),
      name: applicationDisplayValue(doc.original_filename) || applicationDisplayValue(doc.document_type) || "Supporting document",
      type: applicationDisplayValue(doc.document_type) || applicationDisplayValue(doc.mime_type) || "Document",
      size: num(doc.file_size),
      status: applicationDisplayValue(doc.status),
      note: applicationDisplayValue(doc.admin_note),
      url: await signedPrivateDocumentUrl(env, String(doc.storage_path ?? ""))
    }))
  );

  const sections = [
    {
      title: "Applicant",
      rows: applicationRows(row, [
        ["applicant_full_name", "Full name"],
        ["applicant_job_title", "Job title"],
        ["applicant_email", "Email"],
        ["applicant_phone", "Phone"],
        ["preferred_contact_method", "Preferred contact"]
      ])
    },
    {
      title: "Business",
      rows: applicationRows(row, [
        ["legal_business_name", "Legal business name"],
        ["dba_name", "DBA"],
        ["entity_type", "Entity type"],
        ["business_category", "Business category"],
        ["business_description", "Business description"],
        ["website_url", "Website"],
        ["social_media_url", "Social media"],
        ["years_in_business", "Years in business"],
        ["estimated_monthly_volume", "Estimated monthly volume"]
      ])
    },
    {
      title: "Addresses",
      rows: [
        {
          label: "Business address",
          value: [
            row.business_street,
            row.business_address_line_2,
            [row.business_city, row.business_state, row.business_zip].filter(Boolean).join(" "),
            row.business_country
          ].filter(Boolean).join(", ")
        },
        ...applicationRows(row, [
          ["mailing_same_as_business", "Mailing same as business"],
          ["mailing_address_json", "Mailing address"],
          ["shipping_same_as_business", "Shipping same as business"],
          ["shipping_address_json", "Shipping address"]
        ])
      ].filter((item) => item.value)
    },
    {
      title: "Wholesale request",
      rows: applicationRows(row, [
        ["wholesale_requested", "Wholesale requested"],
        ["wholesale_status", "Wholesale status"],
        ["products_interested_json", "Products interested"],
        ["intended_use", "Intended use"],
        ["sales_channels_json", "Sales channels"],
        ["expected_first_order_amount", "Expected first order"],
        ["wholesale_notes", "Notes"],
        ["wholesale_decision_reason", "Decision reason"],
        ["wholesale_decided_at", "Decided at"]
      ])
    },
    {
      title: "Tax exemption request",
      rows: applicationRows(row, [
        ["tax_exemption_requested", "Tax exemption requested"],
        ["tax_exemption_status", "Tax status"],
        ["exemption_type", "Exemption type"],
        ["issuing_state", "Issuing state"],
        ["permit_number", "Permit number"],
        ["certificate_effective_date", "Effective date"],
        ["certificate_expiration_date", "Expiration date"],
        ["certificate_business_name", "Certificate business name"],
        ["certificate_same_as_business", "Certificate same as business"],
        ["certificate_address_json", "Certificate address"],
        ["resale_product_description", "Products for resale"],
        ["no_permit_reason", "No permit reason"],
        ["verification_reference", "Verification reference"],
        ["tax_verification_source", "Verification source"],
        ["tax_verification_date", "Verification date"],
        ["tax_decision_reason", "Decision reason"],
        ["tax_decided_at", "Decided at"]
      ])
    },
    {
      title: "Signature",
      rows: applicationRows(row, [
        ["signer_name", "Signer name"],
        ["signer_title", "Signer title"],
        ["electronic_signature", "Electronic signature"],
        ["signed_at", "Signed at"],
        ["submitted_at", "Submitted at"]
      ])
    },
    {
      title: "Internal review",
      rows: applicationRows(row, [
        ["risk_flag", "Risk flag"],
        ["internal_notes", "Internal notes"],
        ["customer_visible_message", "Customer-visible message"]
      ])
    }
  ].filter((section) => section.rows.length);

  return json({
    application: {
      id: String(row.id),
      type,
      title: applicationDisplayValue(row.legal_business_name) || "Business application",
      number: applicationDisplayValue(row.application_number) || String(row.id).slice(0, 8).toUpperCase(),
      email: applicationDisplayValue(row.applicant_email),
      wholesaleRequested: Boolean(row.wholesale_requested),
      taxRequested: Boolean(row.tax_exemption_requested),
      wholesaleStatus: applicationDisplayValue(row.wholesale_status),
      taxStatus: applicationDisplayValue(row.tax_exemption_status),
      sections,
      documents
    }
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
       pickup_ready_at, picked_up_at, fulfilled_at, tracking_number, shipping_carrier, tracking_url,
       shipping_proof_object_key, shipping_proof_filename, shipping_proof_content_type,
       payment_method, payment_reference, shipping_address_snapshot, cancelled_at, cancel_note, cancelled_by_name, picked_up_by_name, shipped_at,
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
      hasShippingProof: Boolean(
        (order as { shipping_proof_object_key?: string | null }).shipping_proof_object_key
      ),
      shippingProofFilename:
        (order as { shipping_proof_filename?: string | null }).shipping_proof_filename ?? null,
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

  await writeMobileAudit(sb, viewer, {
    action: "product.create",
    entityType: "product",
    entityId: product.id,
    after: { name, slug, sku, retail, cost, barcode: body.barcode ?? null, status }
  });

  return json({ id: product.id, slug, sku }, 201);
}

async function handleProductUpdate(req: Request, env: Env, id: string) {
  const gate = await requireAdmin(req, env);
  if ("error" in gate && gate.error) return gate.error;
  const viewer = gate.viewer!;
  const body = (await req.json()) as Record<string, unknown>;
  const sb = admin(env);

  const [{ data: beforeProduct }, { data: beforeVariants }] = await Promise.all([
    sb
      .from("products")
      .select("name, short_description, description, status, featured")
      .eq("id", id)
      .maybeSingle(),
    sb
      .from("product_variants")
      .select("id, sku, barcode, retail_price, cost_price")
      .eq("product_id", id)
      .eq("is_default", true)
      .limit(1)
  ]);
  const beforeVariant = beforeVariants?.[0];
  const beforeAudit = {
    name: beforeProduct?.name,
    shortDescription: beforeProduct?.short_description ?? "",
    description: beforeProduct?.description ?? "",
    status: beforeProduct?.status,
    featured: beforeProduct?.featured,
    sku: beforeVariant?.sku,
    barcode: beforeVariant?.barcode ?? "",
    retailPrice: beforeVariant ? num(beforeVariant.retail_price) : null,
    costPrice: beforeVariant ? num(beforeVariant.cost_price) : null
  };

  const productPatch: Record<string, unknown> = { updated_by: viewer.id, updated_at: new Date().toISOString() };
  if (body.name != null) productPatch.name = String(body.name).trim();
  if (body.shortDescription != null) productPatch.short_description = String(body.shortDescription);
  if (body.description != null) productPatch.description = String(body.description);
  if (body.status != null) productPatch.status = String(body.status);
  if (body.featured != null) productPatch.featured = Boolean(body.featured);

  const { error: pErr } = await sb.from("products").update(productPatch).eq("id", id);
  if (pErr) return jsonErr("UPDATE_FAILED", pErr.message);

  const variantId = beforeVariant?.id;
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

  await writeMobileAudit(sb, viewer, {
    action: "product.update",
    entityType: "product",
    entityId: id,
    before: beforeAudit,
    after: body
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

function activityLabel(action: string) {
  const labels: Record<string, string> = {
    "order.mark_pickup_ready": "Marked ready for pickup",
    "order.pickup_ready": "Marked ready for pickup",
    "order.confirm_pickup": "Confirmed customer pickup",
    "order.cancel_pickup": "Cancelled pickup",
    "order.cancel": "Cancelled order",
    "order.save_tracking": "Saved tracking / shipping proof",
    "order.confirm_shipped": "Confirmed shipment",
    "order.confirm_delivered": "Confirmed shipped / delivered",
    "order.update_notes": "Updated order notes",
    "order.confirm_payment": "Confirmed payment",
    "order.send_order_email": "Sent customer email",
    "product.create": "Created product",
    "product.update": "Updated product",
    "product.archive": "Archived product",
    "product.restore": "Restored product",
    "product.delete_forever": "Deleted product permanently",
    "product.media_upload": "Added product photo",
    "product.media_delete": "Removed product media",
    "product.video_upload": "Added product video"
  };
  return labels[action] ?? action.replaceAll("_", " ").replaceAll(".", " · ");
}

function auditObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function activityDetail(
  action: string,
  beforeValue: unknown,
  afterValue: unknown,
  metadataValue: unknown
) {
  const before = auditObject(beforeValue);
  const after = auditObject(afterValue);
  const metadata = auditObject(metadataValue);
  const firstText = (...values: unknown[]) =>
    values.find((value) => typeof value === "string" && value.trim()) as string | undefined;
  const explicit = firstText(metadata.reason, after.reason, metadata.note, after.note);
  if (explicit) return explicit.slice(0, 500);

  if (action.includes("tracking") || action.includes("shipped") || action.includes("delivered")) {
    const tracking = firstText(after.trackingNumber, after.tracking_number);
    const carrier = firstText(after.carrier, after.shipping_carrier);
    if (tracking) return [carrier?.toUpperCase(), tracking].filter(Boolean).join(" · ");
  }
  if (action === "product.update") {
    const names: Record<string, string> = {
      name: "name",
      sku: "SKU",
      barcode: "barcode",
      retailPrice: "retail price",
      costPrice: "unit cost",
      shortDescription: "short description",
      description: "description",
      featured: "featured status",
      status: "availability"
    };
    const changed = Object.keys(after)
      .filter((key) => key in names && JSON.stringify(before[key]) !== JSON.stringify(after[key]))
      .map((key) => names[key]);
    if (changed.length) return `Changed ${changed.join(", ")}.`;
  }
  const message = firstText(metadata.message);
  if (message) return message.slice(0, 500);
  const beforeStatus = firstText(before.status);
  const afterStatus = firstText(after.status);
  if (beforeStatus || afterStatus) {
    return [beforeStatus, afterStatus].filter(Boolean).join(" → ");
  }
  return null;
}

async function handleEntityActivity(req: Request, env: Env, url: URL) {
  const gate = await requireAdmin(req, env);
  if ("error" in gate && gate.error) return gate.error;
  const entityType = url.searchParams.get("entityType") ?? "";
  const entityId = url.searchParams.get("entityId") ?? "";
  if (!entityId || !["sales_order", "product"].includes(entityType)) {
    return jsonErr("BAD_REQUEST", "A valid entityType and entityId are required.");
  }

  const sb = admin(env);
  const { data, error } = await sb
    .from("audit_log")
    .select("id, actor_user_id, action, before_data, after_data, metadata, created_at")
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) return jsonErr("LOAD_FAILED", error.message);

  const actorIds = Array.from(
    new Set((data ?? []).map((entry) => entry.actor_user_id).filter((id): id is string => Boolean(id)))
  );
  const actorById = new Map<string, { full_name: string | null; email: string | null }>();
  if (actorIds.length) {
    const { data: profiles } = await sb
      .from("profiles")
      .select("id, full_name, email")
      .in("id", actorIds);
    for (const profile of profiles ?? []) actorById.set(profile.id, profile);
  }

  return json({
    entries: (data ?? []).map((entry) => {
      const profile = entry.actor_user_id ? actorById.get(entry.actor_user_id) : null;
      const metadata = auditObject(entry.metadata);
      const metadataName = typeof metadata.actorName === "string" ? metadata.actorName : null;
      const metadataEmail = typeof metadata.actorEmail === "string" ? metadata.actorEmail : null;
      return {
        id: String(entry.id),
        actorName: profile?.full_name || metadataName || profile?.email || metadataEmail || "System",
        actorEmail: profile?.email || metadataEmail,
        action: entry.action,
        actionLabel: activityLabel(entry.action),
        detail: activityDetail(entry.action, entry.before_data, entry.after_data, entry.metadata),
        createdAt: entry.created_at
      };
    })
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
      valueText: JSON.stringify(s.value),
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
  if (decision !== "approved" && decision !== "rejected") {
    return jsonErr("BAD_REQUEST", "Choose approve or reject.");
  }
  const reason = (body.reason ?? "").trim().slice(0, 1000);
  if (decision === "rejected" && !reason) {
    return jsonErr("REASON_REQUIRED", "A rejection reason is required.");
  }
  const sb = admin(env);
  const now = new Date().toISOString();

  if (body.type === "tax_exemption") {
    const { data: application, error: loadError } = await sb
      .from("tax_exemption_applications")
      .select("id, customer_id, contact_name, business_name, email, status")
      .eq("id", id)
      .maybeSingle();
    if (loadError) return jsonErr("LOAD_FAILED", loadError.message);
    if (!application) return jsonErr("NOT_FOUND", "Application not found.", 404);
    const { error } = await sb
      .from("tax_exemption_applications")
      .update({
        status: decision,
        reviewed_at: now,
        reviewed_by: v.id,
        review_note: reason || null
      })
      .eq("id", id);
    if (error) return jsonErr("DECIDE_FAILED", error.message);
    const { error: customerError } = await sb
      .from("customers")
      .update({
        tax_exempt_status: decision,
        tax_exempt_reason: reason || null,
        tax_exempt_verified_by: v.id,
        tax_exempt_verified_at: now
      })
      .eq("id", application.customer_id);
    if (customerError) return jsonErr("CUSTOMER_UPDATE_FAILED", customerError.message);

    const heading = decision === "approved" ? "Your tax exemption application was approved" : "Your tax exemption application was not approved";
    const reasonText = decision === "rejected" ? `\n\nReason: ${reason}` : "";
    const email = await sendMobileEmail(env, {
      to: application.email,
      subject: `Vinameals tax exemption application — ${decision}`,
      text: `Hello ${application.contact_name},\n\n${heading} for ${application.business_name}.${reasonText}\n\nYou can review your account at https://vinamealsupplies.com/account/tax-exemption\n\nVinameals Supplies`,
      html: `<p>Hello ${escapeEmailHtml(application.contact_name)},</p><p>${escapeEmailHtml(heading)} for <strong>${escapeEmailHtml(application.business_name)}</strong>.</p>${decision === "rejected" ? `<p><strong>Reason:</strong> ${escapeEmailHtml(reason)}</p>` : ""}<p><a href="https://vinamealsupplies.com/account/tax-exemption">Review your application</a></p><p>Vinameals Supplies</p>`
    });
    return json({
      ok: true,
      emailSent: email.sent,
      message: email.sent
        ? `${decision === "approved" ? "Approved" : "Rejected"}; the applicant was emailed.`
        : `${decision === "approved" ? "Approved" : "Rejected"}, but email could not be sent: ${email.error}`
    });
  }

  if (body.type !== "business_wholesale" && body.type !== "business_tax") {
    return jsonErr("BAD_REQUEST", "Unknown application decision type.");
  }
  const { data: application, error: loadError } = await sb
    .from("business_applications")
    .select(
      `id, customer_id, applicant_full_name, applicant_email, legal_business_name,
       application_number, wholesale_requested, tax_exemption_requested, wholesale_status,
       tax_exemption_status, permit_number, issuing_state, certificate_effective_date,
       certificate_expiration_date`
    )
    .eq("id", id)
    .maybeSingle();
  if (loadError) return jsonErr("LOAD_FAILED", loadError.message);
  if (!application) return jsonErr("NOT_FOUND", "Application not found.", 404);
  if (body.type === "business_wholesale" && !application.wholesale_requested) {
    return jsonErr("NOT_REQUESTED", "Wholesale was not requested on this application.");
  }
  if (body.type === "business_tax" && !application.tax_exemption_requested) {
    return jsonErr("NOT_REQUESTED", "Tax exemption was not requested on this application.");
  }

  const patch: Record<string, unknown> = {};
  const previousStatus = body.type === "business_tax"
    ? application.tax_exemption_status
    : application.wholesale_status;
  if (body.type === "business_tax") {
    patch.tax_exemption_status = decision;
    patch.tax_decided_by = v.id;
    patch.tax_decided_at = now;
    patch.tax_decision_reason = reason || null;
  } else {
    patch.wholesale_status = decision;
    patch.wholesale_decided_by = v.id;
    patch.wholesale_decided_at = now;
    patch.wholesale_decision_reason = reason || null;
  }
  const { error } = await sb.from("business_applications").update(patch).eq("id", id);
  if (error) return jsonErr("DECIDE_FAILED", error.message);

  if (body.type === "business_wholesale") {
    const customerPatch: Record<string, unknown> = {
      company_name: application.legal_business_name,
      wholesale_status: decision,
      wholesale_application_id: id
    };
    if (decision === "approved") {
      customerPatch.customer_type = "wholesale";
      customerPatch.wholesale_approved_at = now;
      customerPatch.wholesale_approved_by = v.id;
    }
    const { error: customerError } = await sb
      .from("customers")
      .update(customerPatch)
      .eq("id", application.customer_id);
    if (customerError) return jsonErr("CUSTOMER_UPDATE_FAILED", customerError.message);
  } else {
    const taxPatch: Record<string, unknown> = {
      tax_exempt_status: decision,
      tax_exempt_reason: reason || null,
      tax_exempt_verified_by: v.id,
      tax_exempt_verified_at: now
    };
    if (decision === "approved") {
      taxPatch.tax_exempt_certificate_number = application.permit_number;
      taxPatch.tax_exempt_issuing_state = application.issuing_state;
      taxPatch.tax_exempt_effective_at = application.certificate_effective_date;
      taxPatch.tax_exempt_expires_at = application.certificate_expiration_date;
    }
    const { error: customerError } = await sb
      .from("customers")
      .update(taxPatch)
      .eq("id", application.customer_id);
    if (customerError) return jsonErr("CUSTOMER_UPDATE_FAILED", customerError.message);
  }

  await sb.from("application_reviews").insert({
    application_id: id,
    reviewer_id: v.id,
    review_type: body.type === "business_tax" ? "tax_exemption" : "wholesale",
    previous_status: previousStatus,
    new_status: decision,
    decision,
    reason: reason || null
  });

  const track = body.type === "business_tax" ? "tax exemption" : "wholesale";
  const statusUrl = `https://vinamealsupplies.com/account/business-application/${encodeURIComponent(id)}`;
  const email = await sendMobileEmail(env, {
    to: application.applicant_email,
    subject: `Vinameals ${track} application ${application.application_number} — ${decision}`,
    text: `Hello ${application.applicant_full_name},\n\nYour ${track} application ${application.application_number} for ${application.legal_business_name} was ${decision}.${decision === "rejected" ? `\n\nReason: ${reason}` : ""}\n\nView your application: ${statusUrl}\n\nVinameals Supplies`,
    html: `<p>Hello ${escapeEmailHtml(application.applicant_full_name)},</p><p>Your ${escapeEmailHtml(track)} application <strong>${escapeEmailHtml(application.application_number)}</strong> for ${escapeEmailHtml(application.legal_business_name)} was <strong>${escapeEmailHtml(decision)}</strong>.</p>${decision === "rejected" ? `<p><strong>Reason:</strong> ${escapeEmailHtml(reason)}</p>` : ""}<p><a href="${statusUrl}">View your application</a></p><p>Vinameals Supplies</p>`
  });
  return json({
    ok: true,
    emailSent: email.sent,
    message: email.sent
      ? `${track === "wholesale" ? "Wholesale" : "Tax exemption"} ${decision}; the applicant was emailed.`
      : `${track === "wholesale" ? "Wholesale" : "Tax exemption"} ${decision}, but email could not be sent: ${email.error}`
  });
}

/** Detect PDF/JPEG/PNG/WebP from magic bytes. */
function detectProofType(bytes: Uint8Array): { contentType: string; extension: string } | null {
  const s = (...sig: number[]) =>
    sig.length <= bytes.length && sig.every((b, i) => bytes[i] === b);
  if (s(0x25, 0x50, 0x44, 0x46, 0x2d)) return { contentType: "application/pdf", extension: "pdf" };
  if (s(0xff, 0xd8, 0xff)) return { contentType: "image/jpeg", extension: "jpg" };
  if (s(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))
    return { contentType: "image/png", extension: "png" };
  if (
    s(0x52, 0x49, 0x46, 0x46) &&
    bytes.length >= 12 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return { contentType: "image/webp", extension: "webp" };
  }
  return null;
}

async function uploadShippingProofR2(
  env: Env,
  orderId: string,
  base64: string,
  filename: string,
  declaredType: string
): Promise<{ key: string } | { error: string }> {
  if (
    !env.CLOUDFLARE_ACCOUNT_ID ||
    !env.R2_ACCESS_KEY_ID ||
    !env.R2_SECRET_ACCESS_KEY ||
    !env.R2_DOCUMENTS_BUCKET
  ) {
    return {
      error:
        "R2 documents storage is not configured on mobile-api worker. Set CLOUDFLARE_ACCOUNT_ID, R2_* secrets."
    };
  }

  const cleaned = base64.replace(/^data:[^;]+;base64,/, "");
  let binary: Uint8Array;
  try {
    const raw = atob(cleaned);
    binary = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) binary[i] = raw.charCodeAt(i);
  } catch {
    return { error: "Invalid proof file encoding." };
  }
  if (binary.byteLength <= 0) return { error: "Empty file." };
  if (binary.byteLength > 5 * 1024 * 1024) return { error: "File larger than 5 MB." };

  const detected = detectProofType(binary);
  if (!detected) {
    return { error: "Only real PDF, JPEG, PNG, or WebP files are accepted." };
  }

  const key = `shipping-proof/${orderId}/${crypto.randomUUID()}.${detected.extension}`;
  const { AwsClient } = await import("aws4fetch");
  const client = new AwsClient({
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY
  });
  const url = `https://${env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com/${env.R2_DOCUMENTS_BUCKET}/${key}`;
  const res = await client.fetch(url, {
    method: "PUT",
    headers: {
      "Content-Type": detected.contentType || declaredType || "application/octet-stream",
      "Content-Disposition": `inline; filename="${filename.replace(/[^A-Za-z0-9._-]+/g, "-").slice(0, 80)}"`
    },
    body: binary
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return { error: `R2 upload failed (${res.status}): ${text.slice(0, 200)}` };
  }
  return { key };
}
