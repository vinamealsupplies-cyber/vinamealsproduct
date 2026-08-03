import { fetchVariantHistory } from "@/app/admin/inventory/actions";
import { requireMobileAdmin } from "@/lib/mobile-api/auth";
import { jsonError, jsonOk } from "@/lib/mobile-api/http";
import { runWithViewer } from "@/lib/mobile-api/request-viewer";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const gate = await requireMobileAdmin(request);
  if (!gate.ok) return gate.response;

  const url = new URL(request.url);
  const variantId = url.searchParams.get("variantId") ?? "";
  const locationId = url.searchParams.get("locationId") ?? "";

  const result = await runWithViewer(gate.viewer, () =>
    fetchVariantHistory(variantId, locationId)
  );
  if (!result.ok) {
    return jsonError("LOAD_FAILED", result.message, 400);
  }
  return jsonOk({ movements: result.movements });
}
