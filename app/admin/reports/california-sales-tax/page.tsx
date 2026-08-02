import Link from "next/link";
import { ChevronLeft, Download, FileSpreadsheet } from "lucide-react";
import { AdminPageHeader } from "@/components/admin-page-header";
import { SalesTaxReportView } from "@/components/sales-tax-report";
import { requireStaffPage } from "@/lib/auth";
import {
  getSalesTaxReport,
  type SalesTaxFilters,
  type SalesTaxReport
} from "@/lib/data/sales-tax-report";

export const metadata = { title: "California Sales Tax" };

type SearchParams = Promise<{
  from?: string;
  to?: string;
  state?: string;
  city?: string;
  county?: string;
  zip?: string;
  rate?: string;
}>;

export default async function CaliforniaSalesTaxPage({
  searchParams
}: {
  searchParams: SearchParams;
}) {
  await requireStaffPage();
  const p = await searchParams;
  const filters: SalesTaxFilters = {
    from: p.from || null,
    to: p.to || null,
    state: p.state || null,
    city: p.city || null,
    county: p.county || null,
    zip: p.zip || null,
    rate: p.rate || null
  };

  let report: SalesTaxReport | null = null;
  let loadError: string | null = null;
  try {
    report = await getSalesTaxReport(filters);
  } catch (error) {
    loadError = error instanceof Error ? error.message : "Could not load the sales tax report.";
  }

  const exportParams = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value) exportParams.set(key, String(value));
  }
  const qs = exportParams.toString();
  const csvHref = `/api/admin/reports/california-sales-tax/export?format=csv${qs ? `&${qs}` : ""}`;
  const xlsxHref = `/api/admin/reports/california-sales-tax/export?format=xlsx${qs ? `&${qs}` : ""}`;

  return (
    <>
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <Link href="/admin/reports">
          <ChevronLeft size={14} /> Reports
        </Link>
      </nav>
      <AdminPageHeader
        eyebrow="Analytics"
        title="California Sales Tax"
        description="CDTFA filing report — sales tax grouped by jurisdiction (state, county, city, ZIP, rate). Expand a row to see the orders behind each line, then export for filing."
        action={
          <div className="button-row">
            <Link className="button secondary" href={csvHref} prefetch={false}>
              <Download size={16} aria-hidden="true" /> CSV
            </Link>
            <Link className="button primary" href={xlsxHref} prefetch={false}>
              <FileSpreadsheet size={16} aria-hidden="true" /> Excel
            </Link>
          </div>
        }
      />

      {loadError ? (
        <div className="form-error" role="alert">
          {loadError}
        </div>
      ) : report ? (
        <SalesTaxReportView report={report} filters={filters} />
      ) : null}
    </>
  );
}
