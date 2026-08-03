import { createAdminClient } from "@/lib/supabase/admin";
import { requireMobileStaff } from "@/lib/mobile-api/auth";
import { jsonError, jsonOk } from "@/lib/mobile-api/http";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const gate = await requireMobileStaff(request);
  if (!gate.ok) return gate.response;

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("categories")
      .select("id, parent_id, name, slug, sort_order, is_active, tax_category")
      .order("sort_order")
      .order("name");
    if (error) throw error;
    return jsonOk({
      categories: (data ?? []).map((c) => ({
        id: c.id,
        parentId: c.parent_id,
        name: c.name,
        slug: c.slug,
        sortOrder: c.sort_order,
        isActive: c.is_active,
        taxCategory: c.tax_category
      }))
    });
  } catch (error) {
    return jsonError(
      "LOAD_FAILED",
      error instanceof Error ? error.message : "Could not load categories.",
      500
    );
  }
}
