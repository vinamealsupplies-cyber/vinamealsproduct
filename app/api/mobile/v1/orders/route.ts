import { requireMobileUser } from "@/lib/mobile-api/auth";
import { jsonError, jsonOk } from "@/lib/mobile-api/http";
import { getOwnOrders } from "@/lib/data/customer-orders";

export const runtime = "nodejs";

/** Customer order history. */
export async function GET(request: Request) {
  const gate = await requireMobileUser(request);
  if (!gate.ok) return gate.response;

  try {
    const orders = await getOwnOrders(gate.viewer.id);
    return jsonOk({ orders });
  } catch (error) {
    return jsonError(
      "LOAD_FAILED",
      error instanceof Error ? error.message : "Could not load orders.",
      500
    );
  }
}
