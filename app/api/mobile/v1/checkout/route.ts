import { placeOrder, type CheckoutItem, type CheckoutOptions } from "@/app/(storefront)/checkout/actions";
import { requireMobileUser } from "@/lib/mobile-api/auth";
import { jsonError, jsonOk } from "@/lib/mobile-api/http";
import { runWithViewer } from "@/lib/mobile-api/request-viewer";

export const runtime = "nodejs";

/**
 * Place order for the authenticated customer.
 * Body: { items, fulfillmentMethod, shippingAddressId?, paymentMethod?,
 *         paymentReference?, phone?, deliveryNote?, forcePaidTest? }
 */
export async function POST(request: Request) {
  const gate = await requireMobileUser(request);
  if (!gate.ok) return gate.response;

  let body: {
    items?: CheckoutItem[];
    fulfillmentMethod?: "pickup" | "ship";
    shippingAddressId?: string | null;
    paymentMethod?: string;
    paymentReference?: string | null;
    phone?: string | null;
    deliveryNote?: string | null;
    forcePaidTest?: boolean;
  };

  try {
    body = await request.json();
  } catch {
    return jsonError("BAD_REQUEST", "Invalid JSON body.");
  }

  const items = body.items ?? [];
  if (!items.length) return jsonError("EMPTY_CART", "Cart is empty.");

  const options: CheckoutOptions = {
    fulfillmentMethod: body.fulfillmentMethod ?? "pickup",
    shippingAddressId: body.shippingAddressId,
    paymentMethod: body.paymentMethod,
    paymentReference: body.paymentReference,
    phone: body.phone,
    deliveryNote: body.deliveryNote,
    forcePaidTest: body.forcePaidTest ?? true
  };

  const result = await runWithViewer(gate.viewer, () => placeOrder(items, options));
  if (!result.ok) {
    return jsonError("CHECKOUT_FAILED", result.error, 400);
  }

  return jsonOk(result, { status: 201 });
}
