import {
  cancelOrder,
  cancelPickup,
  confirmDelivered,
  confirmOrderPayment,
  confirmPickup,
  markPickupReady,
  saveShipmentTracking,
  updateOrderNotes
} from "@/app/admin/orders/actions";
import { requireMobileAdmin } from "@/lib/mobile-api/auth";
import { jsonError, jsonOk } from "@/lib/mobile-api/http";
import { runWithViewer } from "@/lib/mobile-api/request-viewer";

export const runtime = "nodejs";

type ActionBody = {
  action?: string;
  note?: string;
  reason?: string;
  carrier?: string;
  trackingNumber?: string;
  customUrl?: string;
  markShipped?: boolean;
  notes?: string;
};

/**
 * POST body.action:
 * mark_pickup_ready | confirm_pickup | cancel_pickup | confirm_delivered |
 * cancel | save_tracking | update_notes | confirm_payment
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const gate = await requireMobileAdmin(request);
  if (!gate.ok) return gate.response;

  const { id } = await context.params;
  if (!id) return jsonError("BAD_REQUEST", "Missing order id.");

  let body: ActionBody;
  try {
    body = await request.json();
  } catch {
    return jsonError("BAD_REQUEST", "Invalid JSON body.");
  }

  const action = (body.action ?? "").trim();
  if (!action) return jsonError("BAD_REQUEST", "Missing action.");

  const result = await runWithViewer(gate.viewer, async () => {
    switch (action) {
      case "mark_pickup_ready":
        return markPickupReady(id, body.note ?? "");
      case "confirm_pickup":
        return confirmPickup(id, body.note ?? "");
      case "cancel_pickup":
        return cancelPickup(id, body.reason ?? body.note ?? "");
      case "confirm_delivered":
        return confirmDelivered(id, body.note ?? "");
      case "cancel":
        return cancelOrder(id, body.reason ?? body.note ?? "");
      case "save_tracking":
        return saveShipmentTracking(
          id,
          body.carrier ?? "other",
          body.trackingNumber ?? "",
          body.customUrl ?? "",
          body.markShipped ?? false,
          body.note ?? ""
        );
      case "update_notes":
        return updateOrderNotes(id, body.notes ?? body.note ?? "");
      case "confirm_payment":
        return confirmOrderPayment(id, body.note ?? "");
      default:
        return { ok: false as const, error: `Unknown action: ${action}` };
    }
  });

  if (!result.ok) {
    return jsonError("ACTION_FAILED", result.error, 400);
  }
  return jsonOk({ ok: true, action });
}
