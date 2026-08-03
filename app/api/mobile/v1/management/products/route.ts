import { getAdminProductList } from "@/lib/data/admin-products";
import { requireMobileAdmin } from "@/lib/mobile-api/auth";
import { jsonError, jsonOk } from "@/lib/mobile-api/http";
import { runWithViewer } from "@/lib/mobile-api/request-viewer";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const gate = await requireMobileAdmin(request);
  if (!gate.ok) return gate.response;

  // Seller may list products for daily ops (same as web seller nav for products on some setups)
  // Web matrix: seller can create/edit products. Allow canAccessAdmin.
  const status = new URL(request.url).searchParams.get("status"); // active|draft|archived|all

  try {
    let products = await runWithViewer(gate.viewer, () => getAdminProductList());
    if (status && status !== "all") {
      products = products.filter((p) => p.status === status);
    }
    // Never send cost to seller if present
    const safe = products.map((p) => {
      if (!gate.viewer.isSeller) return p;
      const { ...rest } = p as typeof p & { costPrice?: number };
      if ("costPrice" in rest) delete (rest as { costPrice?: number }).costPrice;
      return rest;
    });
    return jsonOk({ products: safe });
  } catch (error) {
    return jsonError(
      "LOAD_FAILED",
      error instanceof Error ? error.message : "Could not load products.",
      500
    );
  }
}
