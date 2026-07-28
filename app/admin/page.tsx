import Link from "next/link";
import { AlertTriangle, ArrowRight, FileSpreadsheet, PackagePlus } from "lucide-react";
import { AdminPageHeader } from "@/components/admin-page-header";
import { MetricCard } from "@/components/metric-card";
import { PerformanceChart } from "@/components/performance-chart";
import { SearchableTable } from "@/components/searchable-table";
import { SellerDashboardView } from "@/components/seller-dashboard";
import { getViewer } from "@/lib/auth";
import { getDashboardMetrics, getInvoices, getMonthlyPerformance } from "@/lib/data/reporting";
import { getSellerDashboard } from "@/lib/data/seller-dashboard";
import { usd } from "@/lib/format";
import { redirect } from "next/navigation";

export const metadata = { title: "Dashboard" };

export default async function AdminDashboardPage() {
  const viewer = await getViewer();
  if (!viewer?.canAccessAdmin) {
    redirect("/login?next=/admin&message=Staff%20access%20is%20required.");
  }

  // Seller: home giao dịch hằng ngày (không dashboard tài chính đầy đủ).
  if (viewer.isSeller) {
    const data = await getSellerDashboard();
    return <SellerDashboardView data={data} />;
  }

  if (!viewer.isStaff) {
    redirect("/login?next=/admin&message=Staff%20access%20is%20required.");
  }

  const [metrics, performance, invoices] = await Promise.all([
    getDashboardMetrics(),
    getMonthlyPerformance(),
    getInvoices()
  ]);

  const cards = [
    { label: "Net sales", value: usd.format(metrics.netSales), detail: metrics.salesDetail },
    {
      label: "Amount received",
      value: usd.format(metrics.received),
      detail: `${usd.format(metrics.outstanding)} currently outstanding`
    },
    {
      label: "Gross profit",
      value: usd.format(metrics.grossProfit),
      detail: metrics.netSales > 0 ? `${metrics.margin.toFixed(1)}% gross margin` : "Awaiting first sale"
    },
    {
      label: "Inventory value",
      value: usd.format(metrics.inventoryValue),
      detail: `${metrics.lowStockCount} SKU${metrics.lowStockCount === 1 ? "" : "s"} needing attention`
    }
  ];

  const recentInvoices = invoices.slice(0, 10).map((invoice) => ({
    number: invoice.number,
    customer: invoice.customer,
    issueDate: invoice.issueDate,
    total: invoice.total,
    paid: invoice.paid,
    status: invoice.status
  }));

  const unpaidCount = invoices.filter((invoice) => invoice.balanceDue > 0).length;

  return (
    <>
      <AdminPageHeader
        eyebrow="Overview"
        title="Store dashboard"
        description="Monitor sales, cash received, profit, inventory, and exceptions from one place."
        action={
          <div className="button-row">
            <Link className="button secondary" href="/admin/imports">
              <FileSpreadsheet size={17} /> Import products
            </Link>
            <Link className="button primary" href="/admin/products/new">
              <PackagePlus size={17} /> Add product
            </Link>
          </div>
        }
      />
      <section className="metric-grid">
        {cards.map((metric) => (
          <MetricCard key={metric.label} {...metric} />
        ))}
      </section>
      <section className="admin-two-column">
        <article className="admin-panel chart-panel">
          <div className="panel-heading">
            <div>
              <h2>Sales and cash collected</h2>
              <p>Monthly comparison in USD</p>
            </div>
            <Link className="text-link" href="/admin/reports">
              Full reports <ArrowRight size={15} />
            </Link>
          </div>
          {performance.length ? (
            <PerformanceChart data={performance} />
          ) : (
            <p className="field-hint">No invoiced months yet. The chart appears once invoices are issued.</p>
          )}
        </article>
        <article className="admin-panel attention-panel">
          <div className="panel-heading">
            <div>
              <h2>Needs attention</h2>
              <p>Operational exceptions</p>
            </div>
            <AlertTriangle size={21} />
          </div>
          <div className="attention-list">
            <Link href="/admin/inventory">
              <span className="attention-count">{metrics.lowStockCount}</span>
              <div>
                <strong>Low-stock SKUs</strong>
                <p>Available quantity is low or out of stock.</p>
              </div>
              <ArrowRight size={17} />
            </Link>
            <Link href="/admin/invoices">
              <span className="attention-count">{unpaidCount}</span>
              <div>
                <strong>Invoices with a balance</strong>
                <p>Follow up on the remaining amount due.</p>
              </div>
              <ArrowRight size={17} />
            </Link>
            <Link href="/admin/tax-exemptions">
              <span className="attention-count">{metrics.pendingExemptions}</span>
              <div>
                <strong>Exemption reviews pending</strong>
                <p>Verify documentation before changing tax treatment.</p>
              </div>
              <ArrowRight size={17} />
            </Link>
          </div>
        </article>
      </section>
      <section className="admin-section">
        <div className="section-heading split-heading">
          <div>
            <h2>Recent invoices</h2>
            <p>Search and sort the latest billing activity.</p>
          </div>
          <Link className="text-link" href="/admin/invoices">
            View all invoices <ArrowRight size={15} />
          </Link>
        </div>
        <SearchableTable
          columns={[
            { key: "number", label: "Invoice" },
            { key: "customer", label: "Customer" },
            { key: "issueDate", label: "Issue date", kind: "date" },
            { key: "total", label: "Total", kind: "currency", align: "right" },
            { key: "paid", label: "Paid", kind: "currency", align: "right" },
            { key: "status", label: "Status", kind: "status" }
          ]}
          rows={recentInvoices}
          searchPlaceholder="Search invoice or customer"
          defaultSortKey="issueDate"
          emptyMessage="No invoices yet."
        />
      </section>
    </>
  );
}
