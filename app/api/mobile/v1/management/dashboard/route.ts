import { getSellerDashboard } from "@/lib/data/seller-dashboard";
import { requireMobileAdmin } from "@/lib/mobile-api/auth";
import { jsonError, jsonOk } from "@/lib/mobile-api/http";
import { runWithViewer } from "@/lib/mobile-api/request-viewer";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const gate = await requireMobileAdmin(request);
  if (!gate.ok) return gate.response;

  try {
    const dashboard = await runWithViewer(gate.viewer, () => getSellerDashboard());
    return jsonOk(dashboard);
  } catch (error) {
    return jsonError(
      "LOAD_FAILED",
      error instanceof Error ? error.message : "Dashboard unavailable.",
      500
    );
  }
}
