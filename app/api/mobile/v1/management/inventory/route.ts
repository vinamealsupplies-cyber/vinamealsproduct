import { getInventoryForStaff } from "@/lib/data/inventory";
import { redactInventoryForRole, requireMobileAdmin } from "@/lib/mobile-api/auth";
import { jsonError, jsonOk } from "@/lib/mobile-api/http";
import { runWithViewer } from "@/lib/mobile-api/request-viewer";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const gate = await requireMobileAdmin(request);
  if (!gate.ok) return gate.response;

  try {
    const rows = await runWithViewer(gate.viewer, () => getInventoryForStaff());
    return jsonOk({
      items: redactInventoryForRole(rows, gate.viewer),
      canSeeUnitCost: !gate.viewer.isSeller
    });
  } catch (error) {
    return jsonError(
      "LOAD_FAILED",
      error instanceof Error ? error.message : "Could not load inventory.",
      500
    );
  }
}
