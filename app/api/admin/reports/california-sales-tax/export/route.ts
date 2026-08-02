import { NextResponse } from "next/server";
import { requireStaffApi } from "@/lib/auth";
import { buildSalesTaxCsv, buildSalesTaxWorkbook } from "@/lib/data/report-export";
import { getSalesTaxReport, type SalesTaxFilters } from "@/lib/data/sales-tax-report";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const access = await requireStaffApi("staff");
  if (!access.ok) return access.response;

  const url = new URL(request.url);
  const p = url.searchParams;
  const filters: SalesTaxFilters = {
    from: p.get("from"),
    to: p.get("to"),
    state: p.get("state"),
    city: p.get("city"),
    county: p.get("county"),
    zip: p.get("zip"),
    rate: p.get("rate")
  };
  const format = (p.get("format") || "csv").toLowerCase();

  try {
    const report = await getSalesTaxReport(filters);
    const stamp = new Date().toISOString().slice(0, 10);

    if (format === "xlsx" || format === "excel") {
      const buffer = await buildSalesTaxWorkbook(report);
      return new NextResponse(new Uint8Array(buffer), {
        status: 200,
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="california-sales-tax-${stamp}.xlsx"`,
          "Cache-Control": "no-store"
        }
      });
    }

    const csv = buildSalesTaxCsv(report);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="california-sales-tax-${stamp}.csv"`,
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          code: "EXPORT_FAILED",
          message: error instanceof Error ? error.message : "Could not build the export."
        }
      },
      { status: 500 }
    );
  }
}
