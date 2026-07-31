import { NextResponse } from "next/server";
import {
  createShippingAddress,
  updateShippingAddress
} from "@/app/(storefront)/account/addresses/actions";
import { initialAddressFormState } from "@/lib/data/address-form";

/**
 * REST endpoints for shipping addresses.
 *
 * Cart/checkout used to call Server Actions via useActionState. After deploy,
 * browsers often keep an old client bundle (soft navigation) and hit
 * "Server Action … was not found on the server". Plain POST/PATCH avoids
 * action-ID coupling between client and Worker builds.
 */
export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const result = await createShippingAddress(initialAddressFormState, formData);
    return NextResponse.json(result, {
      status: result.status === "success" ? 200 : 400
    });
  } catch (err) {
    const message =
      err instanceof Error && err.message
        ? err.message
        : "Could not save shipping address.";
    return NextResponse.json(
      { status: "error", message },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const formData = await request.formData();
    const result = await updateShippingAddress(initialAddressFormState, formData);
    return NextResponse.json(result, {
      status: result.status === "success" ? 200 : 400
    });
  } catch (err) {
    const message =
      err instanceof Error && err.message
        ? err.message
        : "Could not update shipping address.";
    return NextResponse.json(
      { status: "error", message },
      { status: 500 }
    );
  }
}
