import { getOrdersForStaff } from "@/lib/data/orders";
import { requireMobileAdmin } from "@/lib/mobile-api/auth";
import { jsonError, jsonOk } from "@/lib/mobile-api/http";
import { runWithViewer } from "@/lib/mobile-api/request-viewer";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const gate = await requireMobileAdmin(request);
  if (!gate.ok) return gate.response;

  const url = new URL(request.url);
  const filter = url.searchParams.get("filter"); // open | awaiting | all

  try {
    const orders = await runWithViewer(gate.viewer, () => getOrdersForStaff());
    let list = orders;
    if (filter === "open") {
      list = orders.filter((o) => o.status === "confirmed");
    } else if (filter === "awaiting") {
      list = orders.filter((o) => o.awaitingPickup || o.awaitingPickupPrep || o.awaitingDelivery);
    }
    return jsonOk({ orders: list });
  } catch (error) {
    return jsonError(
      "LOAD_FAILED",
      error instanceof Error ? error.message : "Could not load orders.",
      500
    );
  }
}
