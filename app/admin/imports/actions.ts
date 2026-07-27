"use server";

import { revalidatePath } from "next/cache";
import { getViewer } from "@/lib/auth";
import { callerKey, checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import type { SimpleImportRow } from "@/lib/import/product-import";
import { createAdminClient } from "@/lib/supabase/admin";

export type ImportCommitResult = {
  status: "success" | "error";
  message: string;
  created?: number;
  failed?: Array<{ rowNumber: number; name: string; error: string }>;
};

async function resolveMainLocationId() {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("inventory_locations")
    .select("id")
    .eq("code", "MAIN")
    .maybeSingle();
  if (data?.id) return data.id as string;
  const { data: anyLoc } = await supabase.from("inventory_locations").select("id").limit(1).maybeSingle();
  return (anyLoc?.id as string) ?? null;
}

/**
 * Commit các dòng import đã preview (valid). Mỗi dòng → 1 product + 1 variant + opening inventory.
 * Không gán category → chỉ hiện ở Shop all.
 */
export async function commitProductImportAction(
  rows: SimpleImportRow[]
): Promise<ImportCommitResult> {
  const viewer = await getViewer();
  if (!viewer?.isStaff) return { status: "error", message: "Staff access is required." };
  if (!(await checkRateLimit(await callerKey("admin-import", viewer.id), RATE_LIMITS.mutation))) {
    return { status: "error", message: "Too many imports. Wait a minute and try again." };
  }
  if (!rows.length) return { status: "error", message: "No valid rows to import." };
  if (rows.length > 500) return { status: "error", message: "Import at most 500 rows per commit." };

  const supabase = createAdminClient();
  const locationId = await resolveMainLocationId();
  let created = 0;
  const failed: ImportCommitResult["failed"] = [];

  for (const row of rows) {
    if (row.errors.length) continue;

    const { data: product, error: productError } = await supabase
      .from("products")
      .insert({
        product_handle: row.generatedHandle,
        slug: row.generatedSlug,
        name: row.productName,
        short_description: row.shortDescription || row.productName,
        description: null,
        status: row.status,
        featured: false,
        published_at: row.status === "active" ? new Date().toISOString() : null,
        created_by: viewer.id,
        updated_by: viewer.id
      })
      .select("id")
      .single();

    if (productError || !product) {
      failed!.push({
        rowNumber: row.rowNumber,
        name: row.productName,
        error: productError?.message ?? "Could not create product"
      });
      continue;
    }

    try {
      const { data: variant, error: variantError } = await supabase
        .from("product_variants")
        .insert({
          product_id: product.id,
          variant_name: "Default",
          sku: row.generatedSku,
          retail_price: row.retailPrice,
          sale_price: row.salePrice,
          cost_price: row.costPrice,
          taxable: true,
          track_inventory: true,
          is_default: true,
          is_active: true
        })
        .select("id")
        .single();

      if (variantError || !variant) throw new Error(variantError?.message ?? "Variant failed");

      // Không gán product_categories — trống category, chỉ Shop all thấy.

      if (locationId && row.inventory > 0) {
        const { error: movError } = await supabase.from("inventory_movements").insert({
          variant_id: variant.id,
          location_id: locationId,
          movement_type: "opening",
          quantity_change: row.inventory,
          unit_cost: row.costPrice,
          reason: "Import opening balance",
          created_by: viewer.id
        });
        if (movError) throw new Error(movError.message);
      }

      created += 1;
    } catch (error) {
      await supabase.from("products").delete().eq("id", product.id);
      failed!.push({
        rowNumber: row.rowNumber,
        name: row.productName,
        error: error instanceof Error ? error.message : "Import failed"
      });
    }
  }

  revalidatePath("/admin/products");
  revalidatePath("/admin/inventory");
  revalidatePath("/admin/imports");
  revalidatePath("/products");
  revalidatePath("/", "layout");

  if (created === 0) {
    return {
      status: "error",
      message: failed?.length
        ? `No products imported. First error: ${failed[0].error}`
        : "No products imported.",
      created: 0,
      failed
    };
  }

  return {
    status: "success",
    message: `Imported ${created} product${created === 1 ? "" : "s"}.${
      failed?.length ? ` ${failed.length} row(s) failed.` : ""
    }`,
    created,
    failed: failed?.length ? failed : undefined
  };
}
