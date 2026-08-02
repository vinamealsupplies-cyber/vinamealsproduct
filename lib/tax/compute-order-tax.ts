// Pure sales-tax computation for an order, used at checkout to fill the
// per-line tax and the CDTFA snapshot (order_tax_records).
//
// Rates live in public.tax_jurisdictions (the DB is the source of truth). The
// caller fetches the active jurisdiction rows for the destination state and
// passes them in; this module only does the (testable) arithmetic — the same
// city-match-then-state-default resolution as public.resolve_tax_jurisdiction.
//
// state_tax / district_tax split: the table stores a combined rate per city and
// a state-default ("*") rate. We treat the state-default rate as the state
// portion and the remainder above it as district tax. Good enough for filing;
// refine when the jurisdiction table carries a real state/county/city breakdown.

export type TaxCategory = "grocery" | "prepared_food" | "general";

export type JurisdictionRow = {
  id: string;
  state_code: string | null;
  city: string | null;
  county: string | null;
  zip: string | null;
  general_rate: number | string | null;
  grocery_rate: number | string | null;
  prepared_food_rate: number | string | null;
};

export type TaxInputLine = { amount: number; taxable: boolean; category: TaxCategory };
export type ComputedTaxLine = { tax: number; rate: number };

export type OrderTaxSummary = {
  grossSales: number;
  taxableSubtotal: number;
  taxExemptAmount: number;
  totalTaxableAmount: number;
  salesTaxCollected: number;
  taxRate: number;
  stateTax: number;
  districtTax: number;
  jurisdictionId: string | null;
  jurisdictionLabel: string | null;
  county: string | null;
  jurisdictionCode: string | null;
};

export type OrderTaxResult = { lines: ComputedTaxLine[]; summary: OrderTaxSummary };

const money = (n: number) => Math.round(n * 100) / 100;

function num(value: number | string | null | undefined): number {
  const parsed = typeof value === "string" ? Number.parseFloat(value) : value;
  return typeof parsed === "number" && Number.isFinite(parsed) ? parsed : 0;
}

function norm(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function rateFor(row: JurisdictionRow, category: TaxCategory): number {
  if (category === "grocery") return num(row.grocery_rate);
  // prepared_food falls back to the general rate when no dedicated rate exists,
  // matching public.calculate_sales_tax.
  if (category === "prepared_food") return num(row.prepared_food_rate) || num(row.general_rate);
  return num(row.general_rate);
}

/** City match by name, else the state default row ("*"). */
export function resolveJurisdiction(
  rows: JurisdictionRow[],
  city?: string | null
): JurisdictionRow | null {
  if (!rows.length) return null;
  const cityKey = norm(city);
  if (cityKey) {
    const match = rows.find((row) => norm(row.city) === cityKey);
    if (match) return match;
  }
  return rows.find((row) => row.city === "*") ?? null;
}

export function computeOrderTax(opts: {
  /** Active jurisdiction rows for the destination state. */
  stateRows: JurisdictionRow[];
  city?: string | null;
  lines: TaxInputLine[];
  /** Customer is tax-exempt (approved resale/exemption) → collect no tax. */
  exempt?: boolean;
}): OrderTaxResult {
  const { stateRows, city, lines, exempt } = opts;
  const matched = exempt ? null : resolveJurisdiction(stateRows, city);
  const stateDefault = stateRows.find((row) => row.city === "*") ?? null;

  const computed: ComputedTaxLine[] = [];
  let grossSales = 0;
  let taxableSubtotal = 0;
  let salesTax = 0;

  for (const line of lines) {
    const amount = money(line.amount);
    grossSales = money(grossSales + amount);
    const rate = matched && line.taxable ? rateFor(matched, line.category) : 0;
    if (rate > 0) {
      const lineTax = money(amount * rate);
      taxableSubtotal = money(taxableSubtotal + amount);
      salesTax = money(salesTax + lineTax);
      computed.push({ tax: lineTax, rate });
    } else {
      computed.push({ tax: 0, rate: 0 });
    }
  }

  const baseRate = num(stateDefault?.general_rate);
  let stateTax = money(taxableSubtotal * baseRate);
  if (stateTax > salesTax) stateTax = salesTax;
  const districtTax = money(salesTax - stateTax);

  return {
    lines: computed,
    summary: {
      grossSales,
      taxableSubtotal,
      taxExemptAmount: money(grossSales - taxableSubtotal),
      totalTaxableAmount: taxableSubtotal,
      salesTaxCollected: salesTax,
      taxRate: matched ? num(matched.general_rate) : 0,
      stateTax,
      districtTax,
      jurisdictionId: matched?.id ?? null,
      jurisdictionLabel: matched
        ? matched.city === "*"
          ? `${matched.state_code} (state default)`
          : `${matched.city}, ${matched.state_code}`
        : null,
      county: matched?.county ?? null,
      jurisdictionCode: null
    }
  };
}
