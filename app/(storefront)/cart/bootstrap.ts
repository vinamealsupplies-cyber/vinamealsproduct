"use server";

import { getViewer } from "@/lib/auth";
import type { BusinessAccount } from "@/lib/business-order";
import { getOwnBusinessAccount } from "@/lib/data/business-account";
import { getOwnShippingAddresses } from "@/lib/data/addresses";
import type { CustomerAddress } from "@/lib/data/address-types";
import { getProducts } from "@/lib/data/products";
import { getOwnSpecialRequests } from "@/lib/data/special-requests";
import { isSupabaseAdminConfigured } from "@/lib/env";
import type { Product } from "@/lib/sample-data";
import type { SpecialRequest } from "@/lib/special-request-types";
import { toUserFacingError } from "@/lib/user-facing-error";

export type CartBootstrap =
  | {
      ok: true;
      signedIn: true;
      catalog: Product[];
      shippingAddresses: CustomerAddress[];
      specialRequests: SpecialRequest[];
      businessAccount: BusinessAccount | null;
    }
  | { ok: false; signedIn: false; error?: string }
  | { ok: false; signedIn: true; error: string };

/**
 * Load cart data after the page shell has rendered (client → server action).
 */
export async function loadCartBootstrap(): Promise<CartBootstrap> {
  try {
    const viewer = await getViewer();
    if (!viewer || viewer.demo) {
      return { ok: false, signedIn: false };
    }

    const canLoad = isSupabaseAdminConfigured();
    const catalog = await getProducts().catch(() => [] as Product[]);

    const [addrR, reqR, bizR] = await Promise.allSettled([
      canLoad ? getOwnShippingAddresses(viewer.id) : Promise.resolve([] as CustomerAddress[]),
      canLoad ? getOwnSpecialRequests(viewer.id) : Promise.resolve([] as SpecialRequest[]),
      canLoad ? getOwnBusinessAccount(viewer.id) : Promise.resolve(null as BusinessAccount | null)
    ]);

    return {
      ok: true,
      signedIn: true,
      catalog,
      shippingAddresses: addrR.status === "fulfilled" ? addrR.value : [],
      specialRequests: reqR.status === "fulfilled" ? reqR.value : [],
      businessAccount: bizR.status === "fulfilled" ? bizR.value : null
    };
  } catch (err) {
    return {
      ok: false,
      signedIn: true,
      error: toUserFacingError(err, "Could not load cart. Please try again in 2 minutes.")
    };
  }
}
