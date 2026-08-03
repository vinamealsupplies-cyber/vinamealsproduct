import { updateInventoryPricingAction } from "@/app/admin/inventory/actions";
import { requireMobileAdmin } from "@/lib/mobile-api/auth";
import { jsonError, jsonOk } from "@/lib/mobile-api/http";
import { runWithViewer } from "@/lib/mobile-api/request-viewer";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const gate = await requireMobileAdmin(request);
  if (!gate.ok) return gate.response;

  let body: {
    variantId?: string;
    sku?: string;
    retailPrice?: number;
    costPrice?: number;
  };
  try {
    body = await request.json();
  } catch {
    return jsonError("BAD_REQUEST", "Invalid JSON body.");
  }

  const form = new FormData();
  form.set("variantId", body.variantId ?? "");
  form.set("sku", body.sku ?? "");
  form.set("retailPrice", String(body.retailPrice ?? ""));
  if (body.costPrice != null) form.set("costPrice", String(body.costPrice));

  const result = await runWithViewer(gate.viewer, () =>
    updateInventoryPricingAction({ status: "idle", message: "" }, form)
  );

  if (result.status === "error") {
    return jsonError("PRICING_FAILED", result.message ?? "Pricing update failed.", 400);
  }
  return jsonOk({ message: result.message });
}
