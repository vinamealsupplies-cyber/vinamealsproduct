import { getSellerDashboard } from "@/lib/data/seller-dashboard";
import { getInvoices } from "@/lib/data/reporting";
import { getOrdersForStaff } from "@/lib/data/orders";
import { requireMobileStaff } from "@/lib/mobile-api/auth";
import { jsonError, jsonOk } from "@/lib/mobile-api/http";
import { runWithViewer } from "@/lib/mobile-api/request-viewer";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const gate = await requireMobileStaff(request);
  if (!gate.ok) return gate.response;

  try {
    const [dashboard, invoices, orders] = await runWithViewer(gate.viewer, async () =>
      Promise.all([getSellerDashboard(), getInvoices(), getOrdersForStaff()])
    );

    const fulfilled = orders.filter((o) => o.status === "fulfilled");
    const cancelled = orders.filter((o) => o.status === "cancelled");
    const paidInvoices = invoices.filter((i) => i.balanceDue <= 0);

    return jsonOk({
      dashboard,
      totals: {
        orderCount: orders.length,
        fulfilledCount: fulfilled.length,
        cancelledCount: cancelled.length,
        invoiceCount: invoices.length,
        paidInvoiceCount: paidInvoices.length,
        outstandingBalance: dashboard.outstandingBalance,
        todayOrderTotal: dashboard.todayOrderTotal
      }
    });
  } catch (error) {
    return jsonError(
      "LOAD_FAILED",
      error instanceof Error ? error.message : "Reports unavailable.",
      500
    );
  }
}
