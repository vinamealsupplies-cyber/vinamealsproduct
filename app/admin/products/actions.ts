"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth";
import { callerKey, checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AdminFormState } from "@/lib/data/admin-form";

// CRUD sản phẩm. Ghi bằng service role nên quyền phải kiểm tra tường minh ở
// đây — không có RLS đỡ phía sau.
//
// Vòng đời: draft/active → archived (ẩn khỏi storefront, giữ nguyên lịch sử)
// → xoá vĩnh viễn (chỉ cho hàng đã ngừng bán). `inventory_movements` tham chiếu
// variant với `on delete restrict`, nên hàng từng phát sinh tồn kho sẽ bị DB
// chặn xoá cứng; ta báo lý do rõ ràng thay vì để lộ lỗi Postgres.

const STATUSES = new Set(["draft", "active", "archived"]);

function fail(message: string): AdminFormState {
  return { status: "error", message };
}

async function guard(scope: string, needManager = false) {
  const viewer = await getViewer();
  if (!viewer?.isStaff) return { viewer: null, error: fail("Staff access is required.") };
  if (needManager && !viewer.isManager) {
    return { viewer: null, error: fail("Manager access is required for this action.") };
  }
  if (!(await checkRateLimit(await callerKey(scope, viewer.id), RATE_LIMITS.mutation))) {
    return { viewer: null, error: fail("Too many changes in a short time. Wait a minute and try again.") };
  }
  return { viewer, error: null };
}

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function readForm(formData: FormData) {
  const text = (name: string, max = 300) => String(formData.get(name) ?? "").trim().slice(0, max);
  const number = (name: string) => {
    const parsed = Number.parseFloat(String(formData.get(name) ?? ""));
    return Number.isFinite(parsed) ? parsed : null;
  };
  const name = text("name", 160);
  const rawStatus = text("status", 20);

  return {
    name,
    slug: slugify(text("slug", 160) || name),
    shortDescription: text("shortDescription", 180),
    description: text("description", 4000),
    categoryId: text("categoryId", 60),
    status: STATUSES.has(rawStatus) ? rawStatus : "draft",
    featured: formData.get("featured") !== null,
    variantName: text("variantName", 80) || "Default",
    sku: text("sku", 60),
    barcode: text("barcode", 60) || null,
    retailPrice: number("retailPrice"),
    wholesalePrice: number("wholesalePrice"),
    costPrice: number("costPrice"),
    openingQuantity: number("openingQuantity") ?? 0,
    locationCode: text("locationCode", 30) || "MAIN",
    trackInventory: formData.get("trackInventory") !== null,
    taxable: formData.get("taxable") !== null
  };
}

function validate(input: ReturnType<typeof readForm>) {
  if (!input.name) return "Product name is required.";
  if (!input.slug) return "Slug is required (letters and numbers).";
  if (!input.shortDescription) return "Short description is required.";
  if (!input.sku) return "SKU is required.";
  if (input.retailPrice === null || input.retailPrice < 0) return "Enter a retail price of 0 or more.";
  if (input.costPrice === null || input.costPrice < 0) return "Enter a unit cost of 0 or more.";
  if (input.wholesalePrice !== null && input.wholesalePrice < 0) return "Wholesale price cannot be negative.";
  if (input.openingQuantity < 0) return "Opening quantity cannot be negative.";
  return null;
}

function friendlyError(message: string) {
  if (message.includes("products_slug_key")) return "Another product already uses that slug.";
  if (message.includes("product_handle")) return "Another product already uses that handle.";
  if (message.includes("product_variants_sku_lower_uidx")) return "Another product already uses that SKU.";
  if (message.includes("product_variants_barcode_uidx")) return "Another product already uses that barcode.";
  return message;
}

function revalidate() {
  revalidatePath("/admin/products");
  revalidatePath("/admin/inventory");
  revalidatePath("/admin");
  // Storefront đọc catalog nên phải làm mới cả layout (menu) lẫn trang bán.
  revalidatePath("/", "layout");
}

async function resolveLocationId(code: string) {
  const supabase = createAdminClient();
  const { data } = await supabase.from("inventory_locations").select("id").eq("code", code).maybeSingle();
  return data?.id ?? null;
}

export async function createProductAction(_prev: AdminFormState, formData: FormData): Promise<AdminFormState> {
  const { viewer, error: denied } = await guard("admin-product");
  if (denied) return denied;

  const input = readForm(formData);
  const invalid = validate(input);
  if (invalid) return fail(invalid);

  const supabase = createAdminClient();
  const { data: product, error: productError } = await supabase
    .from("products")
    .insert({
      product_handle: input.slug,
      slug: input.slug,
      name: input.name,
      short_description: input.shortDescription,
      description: input.description || null,
      status: input.status,
      featured: input.featured,
      published_at: input.status === "active" ? new Date().toISOString() : null,
      created_by: viewer!.id,
      updated_by: viewer!.id
    })
    .select("id")
    .single();

  if (productError) return fail(friendlyError(productError.message));

  // Từ đây trở đi nếu hỏng thì xoá sản phẩm vừa tạo để không để lại bản ghi dở.
  try {
    const { data: variant, error: variantError } = await supabase
      .from("product_variants")
      .insert({
        product_id: product.id,
        variant_name: input.variantName,
        sku: input.sku,
        barcode: input.barcode,
        retail_price: input.retailPrice,
        wholesale_price: input.wholesalePrice,
        cost_price: input.costPrice,
        taxable: input.taxable,
        track_inventory: input.trackInventory,
        is_default: true,
        is_active: true
      })
      .select("id")
      .single();
    if (variantError) throw new Error(friendlyError(variantError.message));

    if (input.categoryId) {
      const { error } = await supabase
        .from("product_categories")
        .insert({ product_id: product.id, category_id: input.categoryId, is_primary: true });
      if (error) throw new Error(error.message);
    }

    const locationId = await resolveLocationId(input.locationCode);
    if (locationId && input.trackInventory) {
      // Tồn kho ban đầu đi qua sổ cái để số lượng luôn giải thích được.
      if (input.openingQuantity > 0) {
        const { error } = await supabase.from("inventory_movements").insert({
          variant_id: variant.id,
          location_id: locationId,
          movement_type: "opening",
          quantity_change: input.openingQuantity,
          unit_cost: input.costPrice,
          reason: "Opening balance",
          created_by: viewer!.id
        });
        if (error) throw new Error(error.message);
      }
    }
  } catch (error) {
    await supabase.from("products").delete().eq("id", product.id);
    return fail(error instanceof Error ? error.message : "The product could not be saved.");
  }

  revalidate();
  redirect(`/admin/products?saved=${encodeURIComponent(input.name)}`);
}

export async function updateProductAction(_prev: AdminFormState, formData: FormData): Promise<AdminFormState> {
  const { viewer, error: denied } = await guard("admin-product");
  if (denied) return denied;

  const id = String(formData.get("id") ?? "").trim();
  const variantId = String(formData.get("variantId") ?? "").trim();
  if (!id) return fail("Missing product id.");

  const input = readForm(formData);
  const invalid = validate(input);
  if (invalid) return fail(invalid);

  const supabase = createAdminClient();
  const { data: current } = await supabase.from("products").select("status, published_at").eq("id", id).maybeSingle();

  const { error: productError } = await supabase
    .from("products")
    .update({
      slug: input.slug,
      name: input.name,
      short_description: input.shortDescription,
      description: input.description || null,
      status: input.status,
      featured: input.featured,
      // Lần đầu chuyển sang active thì ghi mốc xuất bản.
      published_at:
        input.status === "active" && !current?.published_at ? new Date().toISOString() : current?.published_at ?? null,
      updated_by: viewer!.id
    })
    .eq("id", id);

  if (productError) return fail(friendlyError(productError.message));

  if (variantId) {
    const { error: variantError } = await supabase
      .from("product_variants")
      .update({
        variant_name: input.variantName,
        sku: input.sku,
        barcode: input.barcode,
        retail_price: input.retailPrice,
        wholesale_price: input.wholesalePrice,
        cost_price: input.costPrice,
        taxable: input.taxable,
        track_inventory: input.trackInventory
      })
      .eq("id", variantId);
    if (variantError) return fail(friendlyError(variantError.message));
  }

  // Danh mục chính: xoá liên kết cũ rồi gắn cái mới.
  await supabase.from("product_categories").delete().eq("product_id", id);
  if (input.categoryId) {
    await supabase
      .from("product_categories")
      .insert({ product_id: id, category_id: input.categoryId, is_primary: true });
  }

  revalidate();
  return { status: "success", message: `Saved ${input.name}.` };
}

/** "Delete" = chuyển sang archived: ẩn khỏi storefront, giữ toàn bộ lịch sử. */
export async function archiveProductAction(_prev: AdminFormState, formData: FormData): Promise<AdminFormState> {
  const { viewer, error: denied } = await guard("admin-product");
  if (denied) return denied;

  const id = String(formData.get("id") ?? "").trim();
  if (!id) return fail("Missing product id.");

  const supabase = createAdminClient();
  const { data: product } = await supabase.from("products").select("name").eq("id", id).maybeSingle();
  if (!product) return fail("Product not found.");

  const { error } = await supabase
    .from("products")
    .update({ status: "archived", featured: false, updated_by: viewer!.id })
    .eq("id", id);
  if (error) return fail(error.message);

  revalidate();
  return {
    status: "success",
    message: `Archived ${product.name}. Open the Archived tab to edit or restore it.`
  };
}

export async function restoreProductAction(_prev: AdminFormState, formData: FormData): Promise<AdminFormState> {
  const { viewer, error: denied } = await guard("admin-product");
  if (denied) return denied;

  const id = String(formData.get("id") ?? "").trim();
  if (!id) return fail("Missing product id.");

  const supabase = createAdminClient();
  const { data: product } = await supabase.from("products").select("name").eq("id", id).maybeSingle();
  if (!product) return fail("Product not found.");

  const { error } = await supabase
    .from("products")
    .update({ status: "active", published_at: new Date().toISOString(), updated_by: viewer!.id })
    .eq("id", id);
  if (error) return fail(error.message);

  revalidate();
  return { status: "success", message: `${product.name} is active again.` };
}

/**
 * Xoá vĩnh viễn — chỉ dành cho hàng đã ngừng bán hẳn.
 * Chỉ manager, và chỉ khi sản phẩm đã ở trạng thái archived (tránh xoá nhầm
 * hàng đang bán). Variant/ảnh/liên kết danh mục/tồn kho sẽ bị cascade theo.
 */
export async function deleteProductForeverAction(
  _prev: AdminFormState,
  formData: FormData
): Promise<AdminFormState> {
  const { error: denied } = await guard("admin-product", true);
  if (denied) return denied;

  const id = String(formData.get("id") ?? "").trim();
  if (!id) return fail("Missing product id.");

  const supabase = createAdminClient();
  const { data: product } = await supabase.from("products").select("name, status").eq("id", id).maybeSingle();
  if (!product) return fail("Product not found.");
  if (product.status !== "archived") {
    return fail("Archive the product first, then delete it forever.");
  }

  const { error } = await supabase.from("products").delete().eq("id", id);

  if (error) {
    // inventory_movements giữ variant lại (on delete restrict) để sổ cái không thủng.
    if (error.code === "23503") {
      return fail(
        "Cannot delete forever: this product has inventory movement history. Keep it archived so stock records stay auditable."
      );
    }
    return fail(error.message);
  }

  revalidate();
  return { status: "success", message: `Deleted ${product.name} permanently.` };
}
