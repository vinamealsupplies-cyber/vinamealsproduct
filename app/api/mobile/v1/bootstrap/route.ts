import { getViewerFromBearer } from "@/lib/mobile-api/auth";
import { jsonOk } from "@/lib/mobile-api/http";
import { getStoreBusinessProfile } from "@/lib/data/store-settings";
import { createPublicClient } from "@/lib/supabase/public";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const viewer = await getViewerFromBearer(request);
  const supabase = createPublicClient();
  const { data: categories } = await supabase
    .from("categories")
    .select("id, name, slug, is_active")
    .eq("is_active", true)
    .order("name");

  let storeName = "Vinameals";
  try {
    const profile = await getStoreBusinessProfile();
    storeName = profile.displayName || profile.legalName || storeName;
  } catch {
    // optional
  }

  return jsonOk({
    storeName,
    siteOrigin: process.env.NEXT_PUBLIC_SITE_ORIGIN ?? "https://vinamealsupplies.com",
    categories: (categories ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug
    })),
    viewer: viewer
      ? {
          id: viewer.id,
          email: viewer.email,
          fullName: viewer.fullName,
          role: viewer.role,
          canAccessManagement: viewer.canAccessAdmin
        }
      : null,
    features: {
      googleOAuth: true,
      checkout: true,
      management: true,
      forcePaidTestCheckout: true
    }
  });
}
