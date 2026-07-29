"use server";

import { getViewer } from "@/lib/auth";
import { getOwnShippingAddresses } from "@/lib/data/addresses";
import type { CustomerAddress } from "@/lib/data/address-types";
import { getProducts } from "@/lib/data/products";
import { getOwnSpecialRequests } from "@/lib/data/special-requests";
import {
  getOwnWholesaleAccount,
  getWholesalePriceMap
} from "@/lib/data/wholesale-account";
import { isSupabaseAdminConfigured } from "@/lib/env";
import type { Product } from "@/lib/sample-data";
import type { SpecialRequest } from "@/lib/special-request-types";
import { toUserFacingError } from "@/lib/user-facing-error";
import type { WholesaleAccount } from "@/lib/wholesale";

export type CartBootstrap =
  | {
      ok: true;
      signedIn: true;
      catalog: Product[];
      shippingAddresses: CustomerAddress[];
      specialRequests: SpecialRequest[];
      wholesaleAccount: WholesaleAccount | null;
      wholesalePriceByProductId: Record<string, number>;
    }
  | { ok: false; signedIn: false; error?: string }
  | { ok: false; signedIn: true; error: string };

/**
 * Load cart data after the page shell has rendered (client → server action).
 * Keeps /cart HTML SSR free of catalog/DB work so Cloudflare Free is less likely
 * to kill the route with "Server Components render" / overload errors.
 */
export async function loadCartBootstrap(): Promise<CartBootstrap> {
  try {
    const viewer = await getViewer();
    if (!viewer || viewer.demo) {
      return { ok: false, signedIn: false };
    }

    const canLoad = isSupabaseAdminConfigured();
    const catalog = await getProducts().catch(() => [] as Product[]);

    const [addrR, reqR, wholeR] = await Promise.allSettled([
      canLoad ? getOwnShippingAddresses(viewer.id) : Promise.resolve([] as CustomerAddress[]),
      canLoad ? getOwnSpecialRequests(viewer.id) : Promise.resolve([] as SpecialRequest[]),
      canLoad
        ? getOwnWholesaleAccount(viewer.id)
        : Promise.resolve(null as WholesaleAccount | null)
    ]);

    const wholesaleAccount = wholeR.status === "fulfilled" ? wholeR.value : null;
    let wholesalePriceByProductId: Record<string, number> = {};
    if (wholesaleAccount?.isWholesale && catalog.length) {
      try {
        const map = await getWholesalePriceMap(catalog.map((p) => p.id));
        wholesalePriceByProductId = Object.fromEntries(map.entries());
      } catch {
        wholesalePriceByProductId = {};
      }
    }

    return {
      ok: true,
      signedIn: true,
      catalog,
      shippingAddresses: addrR.status === "fulfilled" ? addrR.value : [],
      specialRequests: reqR.status === "fulfilled" ? reqR.value : [],
      wholesaleAccount,
      wholesalePriceByProductId
    };
  } catch (err) {
    return {
      ok: false,
      signedIn: true,
      error: toUserFacingError(err, "Could not load cart. Please try again in 2 minutes.")
    };
  }
}
