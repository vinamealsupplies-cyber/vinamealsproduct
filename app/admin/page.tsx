import Link from "next/link";
import { AlertTriangle, ArrowRight, FileSpreadsheet, PackagePlus } from "lucide-react";
import { AdminPageHeader } from "@/components/admin-page-header";
import { MetricCard } from "@/components/metric-card";
import { PerformanceChart } from "@/components/performance-chart";
import { SearchableTable } from "@/components/searchable-table";
import { dashboardMetrics, inventoryRows, invoiceRows, monthlyPerformance } from "@/lib/admin-sample-data";

export default function AdminDashboardPage() {
  const lowStock = inventoryRows.filter((row) => row.onHand - row.reserved <= row.reorder);
  return (
    <>
      <AdminPageHeader eyebrow="Overview" title="Store dashboard" description="Monitor sales, cash received, profit, inventory, and exceptions from one place." action={<div className="button-row"><Link className="button secondary" href="/admin/imports"><FileSpreadsheet size={17} /> Import products</Link><Link className="button primary" href="/admin/products/new"><PackagePlus size={17} /> Add product</Link></div>} />
      <section className="metric-grid">{dashboardMetrics.map((metric) => <MetricCard key={metric.label} {...metric} />)}</section>
      <section className="admin-two-column">
        <article className="admin-panel chart-panel">
          <div className="panel-heading"><div><h2>Sales and cash collected</h2><p>Monthly comparison in USD</p></div><Link className="text-link" href="/admin/reports">Full reports <ArrowRight size={15} /></Link></div>
          <PerformanceChart data={monthlyPerformance} />
        </article>
        <article className="admin-panel attention-panel">
          <div className="panel-heading"><div><h2>Needs attention</h2><p>Operational exceptions</p></div><AlertTriangle size={21} /></div>
          <div className="attention-list">
            <Link href="/admin/inventory"><span className="attention-count">{lowStock.length}</span><div><strong>Low-stock SKUs</strong><p>Available quantity is at or below reorder point.</p></div><ArrowRight size={17} /></Link>
            <Link href="/admin/invoices"><span className="attention-count">1</span><div><strong>Partially paid invoice</strong><p>Follow up on the remaining balance.</p></div><ArrowRight size={17} /></Link>
            <Link href="/admin/customers"><span className="attention-count">1</span><div><strong>Exemption review pending</strong><p>Verify documentation before changing tax treatment.</p></div><ArrowRight size={17} /></Link>
          </div>
        </article>
      </section>
      <section className="admin-section">
        <div className="section-heading split-heading"><div><h2>Recent invoices</h2><p>Search and sort the latest billing activity.</p></div><Link className="text-link" href="/admin/invoices">View all invoices <ArrowRight size={15} /></Link></div>
        <SearchableTable columns={[
          { key: "number", label: "Invoice" }, { key: "customer", label: "Customer" }, { key: "issueDate", label: "Issue date", kind: "date" },
          { key: "total", label: "Total", kind: "currency", align: "right" }, { key: "paid", label: "Paid", kind: "currency", align: "right" }, { key: "status", label: "Status", kind: "status" }
        ]} rows={invoiceRows} searchPlaceholder="Search invoice or customer" defaultSortKey="issueDate" />
      </section>
    </>
  );
}
