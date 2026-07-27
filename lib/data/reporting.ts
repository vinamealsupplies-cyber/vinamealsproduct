import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

// Số liệu cho Dashboard và Reports — đọc từ view tổng hợp thật thay vì mảng
// dựng sẵn. Khi chưa có hoá đơn/thanh toán nào thì kết quả rỗng, và giao diện
// hiển thị đúng thực tế đó thay vì con số bịa.

export type MonthlyPerformance = {
  month: string;
  monthStart: string;
  netSales: number;
  shippingRevenue: number;
  taxCollected: number;
  amountInvoiced: number;
  received: number;
  balanceDue: number;
  cogs: number;
  expenses: number;
};

function num(value: unknown) {
  const parsed = typeof value === "string" ? Number.parseFloat(value) : (value as number);
  return typeof parsed === "number" && Number.isFinite(parsed) ? parsed : 0;
}

const MONTH_FORMAT = new Intl.DateTimeFormat("en-US", { month: "long", timeZone: "UTC" });

export async function getMonthlyPerformance(limit = 6): Promise<MonthlyPerformance[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("v_monthly_business_performance")
    .select("*")
    .order("month_start", { ascending: false })
    .limit(limit);

  if (error) return [];

  return ((data ?? []) as Record<string, unknown>[])
    .map((row) => {
      const monthStart = String(row.month_start ?? "");
      return {
        month: monthStart ? MONTH_FORMAT.format(new Date(`${monthStart}T00:00:00Z`)) : "—",
        monthStart,
        netSales: num(row.net_sales),
        shippingRevenue: num(row.shipping_revenue),
        taxCollected: num(row.tax_collected),
        amountInvoiced: num(row.amount_invoiced),
        received: num(row.amount_received),
        balanceDue: num(row.current_balance_due),
        cogs: num(row.cogs),
        expenses: num(row.operating_expenses)
      };
    })
    .reverse();
}

/** Bốn ô số liệu ở đầu dashboard, tính từ dữ liệu thật. */
export async function getDashboardMetrics() {
  const supabase = createAdminClient();
  const [performance, inventory, pendingExemptions] = await Promise.all([
    getMonthlyPerformance(2),
    supabase.from("v_inventory_detail").select("inventory_value, stock_status"),
    supabase
      .from("tax_exemption_applications")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending")
  ]);

  const current = performance.at(-1);
  const previous = performance.length > 1 ? performance.at(-2) : undefined;

  const inventoryRows = (inventory.data ?? []) as { inventory_value: number | string; stock_status: string }[];
  const inventoryValue = inventoryRows.reduce((sum, row) => sum + num(row.inventory_value), 0);
  const lowStockCount = inventoryRows.filter((row) => row.stock_status !== "in_stock").length;

  const netSales = current?.netSales ?? 0;
  const received = current?.received ?? 0;
  const outstanding = current?.balanceDue ?? 0;
  const grossProfit = netSales - (current?.cogs ?? 0);
  const margin = netSales > 0 ? (grossProfit / netSales) * 100 : 0;

  let salesDetail = "No invoiced sales yet";
  if (previous && previous.netSales > 0) {
    const change = ((netSales - previous.netSales) / previous.netSales) * 100;
    salesDetail = `${change >= 0 ? "+" : ""}${change.toFixed(1)}% vs. previous period`;
  } else if (netSales > 0) {
    salesDetail = "First month with invoiced sales";
  }

  return {
    netSales,
    salesDetail,
    received,
    outstanding,
    grossProfit,
    margin,
    inventoryValue,
    lowStockCount,
    pendingExemptions: pendingExemptions.count ?? 0
  };
}

export type SalesOrderRow = {
  id: string;
  number: string | null;
  customer: string;
  date: string;
  channel: string;
  total: number;
  status: string;
};

export async function getSalesOrders(): Promise<SalesOrderRow[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("sales_orders")
    .select("id, order_number, placed_at, channel, total_amount, status, customers ( company_name, first_name, last_name )")
    .order("placed_at", { ascending: false })
    .limit(100);

  type Row = {
    id: string;
    order_number: string | null;
    placed_at: string;
    channel: string;
    total_amount: number | string;
    status: string;
    customers: { company_name: string | null; first_name: string | null; last_name: string | null } | null;
  };

  return ((data ?? []) as unknown as Row[]).map((row) => ({
    id: row.id,
    number: row.order_number,
    customer:
      row.customers?.company_name ??
      [row.customers?.first_name, row.customers?.last_name].filter(Boolean).join(" ") ??
      "—",
    date: row.placed_at,
    channel: row.channel,
    total: num(row.total_amount),
    status: row.status
  }));
}

export type InvoiceRow = {
  id: string;
  number: string | null;
  customer: string;
  issueDate: string;
  total: number;
  paid: number;
  balanceDue: number;
  status: string;
};

export async function getInvoices(): Promise<InvoiceRow[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("invoices")
    .select("id, invoice_number, issue_date, total_amount, amount_paid, balance_due, status, customers ( company_name, first_name, last_name )")
    .order("issue_date", { ascending: false })
    .limit(100);

  type Row = {
    id: string;
    invoice_number: string | null;
    issue_date: string;
    total_amount: number | string;
    amount_paid: number | string;
    balance_due: number | string;
    status: string;
    customers: { company_name: string | null; first_name: string | null; last_name: string | null } | null;
  };

  return ((data ?? []) as unknown as Row[]).map((row) => ({
    id: row.id,
    number: row.invoice_number,
    customer:
      row.customers?.company_name ??
      [row.customers?.first_name, row.customers?.last_name].filter(Boolean).join(" ") ??
      "—",
    issueDate: row.issue_date,
    total: num(row.total_amount),
    paid: num(row.amount_paid),
    balanceDue: num(row.balance_due),
    status: row.status
  }));
}

export type PaymentRow = {
  id: string;
  reference: string | null;
  customer: string;
  receivedAt: string;
  method: string;
  amount: number;
  invoiceNumber: string | null;
  status: string;
};

export async function getPayments(): Promise<PaymentRow[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("payments")
    .select("id, reference, received_at, payment_method, amount, status, invoices ( invoice_number, customers ( company_name, first_name, last_name ) )")
    .order("received_at", { ascending: false })
    .limit(100);

  type Row = {
    id: string;
    reference: string | null;
    received_at: string;
    payment_method: string;
    amount: number | string;
    status: string;
    invoices: {
      invoice_number: string | null;
      customers: { company_name: string | null; first_name: string | null; last_name: string | null } | null;
    } | null;
  };

  return ((data ?? []) as unknown as Row[]).map((row) => ({
    id: row.id,
    reference: row.reference,
    customer:
      row.invoices?.customers?.company_name ??
      [row.invoices?.customers?.first_name, row.invoices?.customers?.last_name].filter(Boolean).join(" ") ??
      "—",
    receivedAt: row.received_at,
    method: row.payment_method,
    amount: num(row.amount),
    invoiceNumber: row.invoices?.invoice_number ?? null,
    status: row.status
  }));
}
