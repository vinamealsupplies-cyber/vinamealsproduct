import { CalendarRange, Download } from "lucide-react";
import { AdminPageHeader } from "@/components/admin-page-header";
import { PerformanceChart } from "@/components/performance-chart";
import { SearchableTable } from "@/components/searchable-table";
import { monthlyPerformance } from "@/lib/admin-sample-data";
import { usd } from "@/lib/format";

export default function ReportsPage() {
  const rows = monthlyPerformance.map((row, index) => ({
    id: index,
    month: row.month,
    netSales: row.netSales,
    shippingRevenue: row.shippingRevenue,
    taxCollected: row.taxCollected,
    amountInvoiced: row.amountInvoiced,
    received: row.received,
    balanceDue: row.balanceDue,
    cogs: row.cogs,
    operatingExpenses: row.expenses,
    grossProfit: row.netSales - row.cogs,
    operatingProfit: row.netSales + row.shippingRevenue - row.cogs - row.expenses
  }));
  const totals = rows.reduce((sum, row) => ({
    netSales: sum.netSales + row.netSales,
    shippingRevenue: sum.shippingRevenue + row.shippingRevenue,
    taxCollected: sum.taxCollected + row.taxCollected,
    amountInvoiced: sum.amountInvoiced + row.amountInvoiced,
    received: sum.received + row.received,
    balanceDue: sum.balanceDue + row.balanceDue,
    cogs: sum.cogs + row.cogs,
    expenses: sum.expenses + row.operatingExpenses,
    operatingProfit: sum.operatingProfit + row.operatingProfit
  }), { netSales: 0, shippingRevenue: 0, taxCollected: 0, amountInvoiced: 0, received: 0, balanceDue: 0, cogs: 0, expenses: 0, operatingProfit: 0 });

  return (
    <>
      <AdminPageHeader eyebrow="Analytics" title="Performance reports" description="Review sales, shipping, tax collected, cash received, cost, expenses, profit, and open balances by month or year." action={<div className="button-row"><button className="button secondary" type="button"><CalendarRange size={17} /> Jan 1–Jul 31, 2026</button><button className="button primary" type="button"><Download size={17} /> Export report</button></div>} />
      <section className="report-kpi-grid">
        <article><span>Net sales</span><strong>{usd.format(totals.netSales)}</strong><small>Merchandise sales less discounts</small></article>
        <article><span>Shipping revenue</span><strong>{usd.format(totals.shippingRevenue)}</strong><small>Shown separately from product sales</small></article>
        <article><span>Tax collected</span><strong>{usd.format(totals.taxCollected)}</strong><small>Collected liability, not revenue</small></article>
        <article><span>Amount invoiced</span><strong>{usd.format(totals.amountInvoiced)}</strong><small>Sales + shipping + tax</small></article>
        <article><span>Amount received</span><strong>{usd.format(totals.received)}</strong><small>Successful payments less refunds</small></article>
        <article><span>Current balance due</span><strong>{usd.format(totals.balanceDue)}</strong><small>Open invoice balances, not sales minus cash</small></article>
        <article><span>Cost of goods</span><strong>{usd.format(totals.cogs)}</strong><small>Item cost snapshots on sales</small></article>
        <article><span>Operating expenses</span><strong>{usd.format(totals.expenses)}</strong><small>Non-inventory business costs</small></article>
        <article><span>Operating profit</span><strong>{usd.format(totals.operatingProfit)}</strong><small>Before income tax and owner adjustments</small></article>
      </section>
      <section className="admin-panel chart-panel report-chart-panel"><div className="panel-heading"><div><h2>Monthly trend</h2><p>Net sales compared with amount received</p></div></div><PerformanceChart data={monthlyPerformance} /></section>
      <section className="admin-section">
        <div className="section-heading"><h2>Monthly detail</h2><p>Sort any column or search for a month.</p></div>
        <SearchableTable columns={[
          { key: "month", label: "Month" }, { key: "netSales", label: "Net sales", kind: "currency", align: "right" }, { key: "shippingRevenue", label: "Shipping", kind: "currency", align: "right" },
          { key: "taxCollected", label: "Tax", kind: "currency", align: "right" }, { key: "amountInvoiced", label: "Invoiced", kind: "currency", align: "right" }, { key: "received", label: "Received", kind: "currency", align: "right" },
          { key: "balanceDue", label: "Balance due", kind: "currency", align: "right" }, { key: "cogs", label: "COGS", kind: "currency", align: "right" }, { key: "grossProfit", label: "Gross profit", kind: "currency", align: "right" },
          { key: "operatingExpenses", label: "Expenses", kind: "currency", align: "right" }, { key: "operatingProfit", label: "Operating profit", kind: "currency", align: "right" }
        ]} rows={rows} searchPlaceholder="Search month" defaultSortKey="id" />
      </section>
      <div className="report-definition-note"><h2>Report definitions matter</h2><p>Net sales, shipping revenue, tax collected, amount invoiced, cash received, and current balance due are deliberately separate. Cash received is grouped by payment date, while balance due comes directly from open invoices. Payment refunds reduce cash received; production returns or credit notes must also reverse sales and COGS.</p></div>
    </>
  );
}
