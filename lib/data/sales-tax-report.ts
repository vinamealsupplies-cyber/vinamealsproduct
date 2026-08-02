import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export type SalesTaxFilters = {
  from?: string | null; // YYYY-MM-DD (inclusive)
  to?: string | null; // YYYY-MM-DD (inclusive)
  state?: string | null;
  city?: string | null;
  county?: string | null;
  zip?: string | null;
  /** Tax rate as a percentage string ("8.75") or decimal ("0.0875"). */
  rate?: string | null;
};

export type SalesTaxOrderRow = {
  orderId: string;
  orderNumber: string;
  orderDate: string | null;
  fulfillmentMethod: string | null;
  country: string | null;
  state: string | null;
  county: string | null;
  city: string | null;
  zip: string | null;
  shippingAddress: string | null;
  grossSales: number;
  taxableSubtotal: number;
  shipping: number;
  shippingTaxable: number;
  exemptAmount: number;
  totalTaxable: number;
  taxCollected: number;
  taxRate: number;
  stateTax: number;
  districtTax: number;
  jurisdictionCode: string | null;
  jurisdictionLabel: string | null;
  paymentStatus: string;
  refundAmount: number;
  netTaxableSales: number;
};

export type SalesTaxGroup = {
  key: string;
  state: string;
  county: string;
  city: string;
  zip: string;
  taxRate: number;
  orderCount: number;
  grossSales: number;
  taxableSales: number;
  exemptSales: number;
  shipping: number;
  taxCollected: number;
  stateTax: number;
  districtTax: number;
  orders: SalesTaxOrderRow[];
};

export type SalesTaxTotals = {
  orderCount: number;
  grossSales: number;
  taxableSales: number;
  exemptSales: number;
  shipping: number;
  taxCollected: number;
  stateTax: number;
  districtTax: number;
};

export type SalesTaxReport = {
  filters: SalesTaxFilters;
  totals: SalesTaxTotals;
  groups: SalesTaxGroup[];
  orders: SalesTaxOrderRow[];
  /** Distinct values for filter dropdowns. */
  facets: { states: string[]; counties: string[]; cities: string[]; zips: string[]; rates: number[] };
};

function num(value: number | string | null | undefined): number {
  const parsed = typeof value === "string" ? Number.parseFloat(value) : value;
  return typeof parsed === "number" && Number.isFinite(parsed) ? parsed : 0;
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

/** Normalize a rate filter ("8.75" or "0.0875") to a decimal for comparison. */
function parseRateFilter(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const n = Number.parseFloat(String(raw).replace("%", "").trim());
  if (!Number.isFinite(n)) return null;
  return n > 1 ? n / 100 : n;
}

type Row = {
  order_id: string;
  invoice_id: string | null;
  order_number: string | null;
  order_date: string | null;
  fulfillment_method: string | null;
  country_code: string | null;
  state_code: string | null;
  county: string | null;
  city: string | null;
  zip: string | null;
  shipping_address: string | null;
  gross_sales: number | string | null;
  taxable_subtotal: number | string | null;
  shipping_amount: number | string | null;
  shipping_taxable_amount: number | string | null;
  tax_exempt_amount: number | string | null;
  total_taxable_amount: number | string | null;
  sales_tax_collected: number | string | null;
  tax_rate: number | string | null;
  state_tax: number | string | null;
  district_tax: number | string | null;
  tax_jurisdiction_code: string | null;
  jurisdiction_label: string | null;
};

export async function getSalesTaxReport(filters: SalesTaxFilters = {}): Promise<SalesTaxReport> {
  const admin = createAdminClient();

  let query = admin
    .from("order_tax_records")
    .select(
      "order_id, invoice_id, order_number, order_date, fulfillment_method, country_code, state_code, county, city, zip, shipping_address, gross_sales, taxable_subtotal, shipping_amount, shipping_taxable_amount, tax_exempt_amount, total_taxable_amount, sales_tax_collected, tax_rate, state_tax, district_tax, tax_jurisdiction_code, jurisdiction_label"
    )
    .order("order_date", { ascending: false })
    .limit(5000);

  if (filters.from) query = query.gte("order_date", filters.from);
  if (filters.to) query = query.lte("order_date", filters.to);
  if (filters.state?.trim()) query = query.eq("state_code", filters.state.trim().toUpperCase());
  if (filters.city?.trim()) query = query.ilike("city", `%${filters.city.trim()}%`);
  if (filters.county?.trim()) query = query.ilike("county", `%${filters.county.trim()}%`);
  if (filters.zip?.trim()) query = query.ilike("zip", `${filters.zip.trim()}%`);

  const rateFilter = parseRateFilter(filters.rate);
  if (rateFilter != null) {
    // Match within a cent of a percentage point to tolerate rounding.
    query = query.gte("tax_rate", rateFilter - 0.00005).lte("tax_rate", rateFilter + 0.00005);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Failed to load sales tax report: ${error.message}`);
  const rows = (data ?? []) as Row[];

  // Payment status + refunds from invoices/payments (live, so refunds are current).
  const invoiceIds = Array.from(
    new Set(rows.map((r) => r.invoice_id).filter((id): id is string => Boolean(id)))
  );
  const invoiceById = new Map<string, { amountPaid: number; total: number; status: string }>();
  const refundByInvoice = new Map<string, number>();
  if (invoiceIds.length) {
    const [{ data: invs }, { data: pays }] = await Promise.all([
      admin.from("invoices").select("id, amount_paid, total_amount, status").in("id", invoiceIds),
      admin
        .from("payments")
        .select("invoice_id, amount, payment_kind, status")
        .in("invoice_id", invoiceIds)
        .eq("payment_kind", "refund")
    ]);
    for (const inv of invs ?? []) {
      invoiceById.set(inv.id as string, {
        amountPaid: num(inv.amount_paid),
        total: num(inv.total_amount),
        status: String(inv.status ?? "")
      });
    }
    for (const p of pays ?? []) {
      if (p.status && p.status !== "succeeded" && p.status !== "completed") continue;
      const id = p.invoice_id as string;
      refundByInvoice.set(id, (refundByInvoice.get(id) ?? 0) + Math.abs(num(p.amount)));
    }
  }

  function paymentStatus(invId: string | null, refund: number): string {
    const inv = invId ? invoiceById.get(invId) : undefined;
    if (!inv) return refund > 0 ? "refunded" : "unknown";
    if (inv.status === "void" || inv.status === "cancelled") return "void";
    if (refund > 0) return refund >= inv.amountPaid && inv.amountPaid > 0 ? "refunded" : "partially_refunded";
    if (inv.total > 0 && inv.amountPaid >= inv.total) return "paid";
    if (inv.amountPaid > 0) return "partial";
    return "unpaid";
  }

  const orders: SalesTaxOrderRow[] = rows.map((r) => {
    const refund = r.invoice_id ? refundByInvoice.get(r.invoice_id) ?? 0 : 0;
    const inv = r.invoice_id ? invoiceById.get(r.invoice_id) : undefined;
    const totalTaxable = num(r.total_taxable_amount);
    const orderTotal = inv?.total ?? 0;
    // Net taxable sales after (proportional) refunds.
    const netTaxable =
      refund <= 0 || orderTotal <= 0
        ? totalTaxable
        : refund >= orderTotal
          ? 0
          : round2(totalTaxable * (1 - refund / orderTotal));
    return {
      orderId: r.order_id,
      orderNumber: r.order_number ?? "",
      orderDate: r.order_date,
      fulfillmentMethod: r.fulfillment_method,
      country: r.country_code,
      state: r.state_code,
      county: r.county,
      city: r.city,
      zip: r.zip,
      shippingAddress: r.shipping_address,
      grossSales: num(r.gross_sales),
      taxableSubtotal: num(r.taxable_subtotal),
      shipping: num(r.shipping_amount),
      shippingTaxable: num(r.shipping_taxable_amount),
      exemptAmount: num(r.tax_exempt_amount),
      totalTaxable,
      taxCollected: num(r.sales_tax_collected),
      taxRate: num(r.tax_rate),
      stateTax: num(r.state_tax),
      districtTax: num(r.district_tax),
      jurisdictionCode: r.tax_jurisdiction_code,
      jurisdictionLabel: r.jurisdiction_label,
      paymentStatus: paymentStatus(r.invoice_id, refund),
      refundAmount: round2(refund),
      netTaxableSales: netTaxable
    };
  });

  // Group by State → County → City → ZIP → Tax Rate (flat leaf groups).
  const groupMap = new Map<string, SalesTaxGroup>();
  for (const o of orders) {
    const state = (o.state ?? "").toUpperCase();
    const county = o.county ?? "";
    const city = o.city ?? "";
    const zip = o.zip ?? "";
    const key = `${state}|${county}|${city}|${zip}|${o.taxRate.toFixed(5)}`;
    let g = groupMap.get(key);
    if (!g) {
      g = {
        key,
        state,
        county,
        city,
        zip,
        taxRate: o.taxRate,
        orderCount: 0,
        grossSales: 0,
        taxableSales: 0,
        exemptSales: 0,
        shipping: 0,
        taxCollected: 0,
        stateTax: 0,
        districtTax: 0,
        orders: []
      };
      groupMap.set(key, g);
    }
    g.orderCount += 1;
    g.grossSales = round2(g.grossSales + o.grossSales);
    g.taxableSales = round2(g.taxableSales + o.totalTaxable);
    g.exemptSales = round2(g.exemptSales + o.exemptAmount);
    g.shipping = round2(g.shipping + o.shipping);
    g.taxCollected = round2(g.taxCollected + o.taxCollected);
    g.stateTax = round2(g.stateTax + o.stateTax);
    g.districtTax = round2(g.districtTax + o.districtTax);
    g.orders.push(o);
  }

  const groups = Array.from(groupMap.values()).sort(
    (a, b) =>
      a.state.localeCompare(b.state) ||
      a.county.localeCompare(b.county) ||
      a.city.localeCompare(b.city) ||
      a.zip.localeCompare(b.zip) ||
      a.taxRate - b.taxRate
  );

  const totals = orders.reduce<SalesTaxTotals>(
    (sum, o) => ({
      orderCount: sum.orderCount + 1,
      grossSales: round2(sum.grossSales + o.grossSales),
      taxableSales: round2(sum.taxableSales + o.totalTaxable),
      exemptSales: round2(sum.exemptSales + o.exemptAmount),
      shipping: round2(sum.shipping + o.shipping),
      taxCollected: round2(sum.taxCollected + o.taxCollected),
      stateTax: round2(sum.stateTax + o.stateTax),
      districtTax: round2(sum.districtTax + o.districtTax)
    }),
    {
      orderCount: 0,
      grossSales: 0,
      taxableSales: 0,
      exemptSales: 0,
      shipping: 0,
      taxCollected: 0,
      stateTax: 0,
      districtTax: 0
    }
  );

  // Facets for filter dropdowns — from the unfiltered dataset would need a second
  // query; here we derive from the current result which is enough for common use.
  const facets = {
    states: uniqueSorted(orders.map((o) => (o.state ?? "").toUpperCase()).filter(Boolean)),
    counties: uniqueSorted(orders.map((o) => o.county ?? "").filter(Boolean)),
    cities: uniqueSorted(orders.map((o) => o.city ?? "").filter(Boolean)),
    zips: uniqueSorted(orders.map((o) => o.zip ?? "").filter(Boolean)),
    rates: uniqueSorted(orders.map((o) => o.taxRate)).sort((a, b) => Number(a) - Number(b)) as number[]
  };

  return { filters, totals, groups, orders, facets };
}

function uniqueSorted<T>(values: T[]): T[] {
  return Array.from(new Set(values)).sort((a, b) =>
    String(a).localeCompare(String(b))
  );
}
