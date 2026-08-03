import { adjustInventoryAction } from "@/app/admin/inventory/actions";
import { requireMobileAdmin } from "@/lib/mobile-api/auth";
import { jsonError, jsonOk } from "@/lib/mobile-api/http";
import { runWithViewer } from "@/lib/mobile-api/request-viewer";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const gate = await requireMobileAdmin(request);
  if (!gate.ok) return gate.response;

  let body: {
    variantId?: string;
    locationId?: string;
    sku?: string;
    reason?: string;
    mode?: "delta" | "set";
    quantity?: number;
    currentOnHand?: number;
  };
  try {
    body = await request.json();
  } catch {
    return jsonError("BAD_REQUEST", "Invalid JSON body.");
  }

  const form = new FormData();
  form.set("variantId", body.variantId ?? "");
  form.set("locationId", body.locationId ?? "");
  form.set("sku", body.sku ?? "");
  form.set("reason", body.reason ?? "");
  form.set("mode", body.mode ?? "delta");
  form.set("quantity", String(body.quantity ?? ""));
  form.set("currentOnHand", String(body.currentOnHand ?? 0));

  const result = await runWithViewer(gate.viewer, () =>
    adjustInventoryAction({ status: "idle", message: "" }, form)
  );

  if (result.status === "error") {
    return jsonError("ADJUST_FAILED", result.message ?? "Adjustment failed.", 400);
  }
  return jsonOk({ message: result.message });
}
