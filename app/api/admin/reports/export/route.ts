import { NextResponse } from "next/server";
import { requireStaffApi } from "@/lib/auth";
import { buildPerformanceWorkbook } from "@/lib/data/report-export";
import { resolveReportPeriod } from "@/lib/data/report-period";
import { getMonthlyPerformance, toMonthStart } from "@/lib/data/reporting";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const access = await requireStaffApi("staff");
  if (!access.ok) return access.response;

  const url = new URL(request.url);
  const period = resolveReportPeriod(
    url.searchParams.get("preset"),
    url.searchParams.get("from"),
    url.searchParams.get("to")
  );

  const monthly = await getMonthlyPerformance({
    from: toMonthStart(period.from),
    to: toMonthStart(period.to)
  });

  const rows = monthly.map((row) => ({
    ...row,
    grossProfit: row.netSales - row.cogs,
    operatingProfit: row.netSales + row.shippingRevenue - row.cogs - row.expenses
  }));

  try {
    const buffer = await buildPerformanceWorkbook({
      periodLabel: period.label,
      rows
    });

    const safeLabel = period.label.replace(/[^\w\-]+/g, "_").replace(/_+/g, "_");
    const filename = `vinameals-performance-${safeLabel || "report"}.xlsx`;

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          code: "EXPORT_FAILED",
          message: error instanceof Error ? error.message : "Could not build the workbook."
        }
      },
      { status: 500 }
    );
  }
}
