"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth";
import { writeAuditLog } from "@/lib/data/audit-log";
import { callerKey, checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AdminFormState } from "@/lib/data/admin-form";

// CRUD sản phẩm. Ghi bằng service role nên quyền phải kiểm tra tường minh ở
// đây — không có RLS đỡ phía sau.
//
// Seller + staff: add/edit/archive/restore. Xoá vĩnh viễn: manager only.
// Mọi thao tác ghi audit_log cho admin theo dõi.

const STATUSES = new Set(["draft", "active", "archived"]);

function fail(message: string): AdminFormState {
  return { status: "error", message };
}

async function guard(scope: string, needManager = false) {
  const viewer = await getViewer();
  // Seller cũng được add/sửa sản phẩm (giao dịch hằng ngày).
  if (!viewer?.canAccessAdmin) return { viewer: null, error: fail("Staff access is required.") };
  if (needManager && !viewer.isManager) {
    return { viewer: null, error: fail("Manager access is required for this action.") };
  }
  if (!(await checkRateLimit(await callerKey(scope, viewer.id), RATE_LIMITS.mutation))) {
    return { viewer: null, error: fail("Too many changes in a short time. Wait a minute and try again.") };
  }
  return { viewer, error: null };
}

function actorMeta(viewer: { id: string; email: string; role: string }) {
  return { actorRole: viewer.role, actorEmail: viewer.email };
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
    // Ô trống → null (tắt sale). 0 vẫn là giá hợp lệ nếu < retail.
    salePrice: (() => {
      const raw = String(formData.get("salePrice") ?? "").trim();
      if (!raw) return null;
      return number("salePrice");
    })(),
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
  // Seller gửi cost 0 ẩn — staff phải nhập cost hợp lệ.
  if (input.costPrice === null || input.costPrice < 0) return "Enter a unit cost of 0 or more.";
  if (input.wholesalePrice !== null && input.wholesalePrice < 0) return "Wholesale price cannot be negative.";
  if (input.salePrice !== null) {
    if (input.salePrice < 0) return "Sale price cannot be negative.";
    if (input.salePrice >= input.retailPrice) return "Sale price must be lower than the retail price.";
  }
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
  // Seller không nhập cost — cho phép 0; staff bắt buộc cost hợp lệ đã check trong validate.
  if (viewer?.isSeller && (input.costPrice === null || input.costPrice < 0)) {
    input.costPrice = 0;
  }
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
        sale_price: input.salePrice,
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

  await writeAuditLog({
    actorUserId: viewer!.id,
    action: "product.create",
    entityType: "product",
    entityId: product.id,
    after: {
      name: input.name,
      slug: input.slug,
      sku: input.sku,
      status: input.status,
      retailPrice: input.retailPrice,
      costPrice: input.costPrice,
      openingQuantity: input.openingQuantity
    },
    metadata: actorMeta(viewer!)
  });

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
  const supabase = createAdminClient();
  const { data: current } = await supabase
    .from("products")
    .select("status, published_at, name, slug, short_description")
    .eq("id", id)
    .maybeSingle();

  const { data: currentVariant } = variantId
    ? await supabase
        .from("product_variants")
        .select("sku, retail_price, sale_price, wholesale_price, cost_price")
        .eq("id", variantId)
        .maybeSingle()
    : { data: null };

  // Seller không đổi cost — giữ cost hiện tại.
  if (viewer?.isSeller && currentVariant?.cost_price != null) {
    input.costPrice = Number(currentVariant.cost_price);
  } else if (viewer?.isSeller) {
    input.costPrice = input.costPrice ?? 0;
  }

  const invalid = validate(input);
  if (invalid) return fail(invalid);

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
        sale_price: input.salePrice,
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

  await writeAuditLog({
    actorUserId: viewer!.id,
    action: "product.update",
    entityType: "product",
    entityId: id,
    before: { product: current, variant: currentVariant },
    after: {
      name: input.name,
      slug: input.slug,
      status: input.status,
      sku: input.sku,
      retailPrice: input.retailPrice,
      salePrice: input.salePrice,
      costPrice: input.costPrice
    },
    metadata: actorMeta(viewer!)
  });

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

  await writeAuditLog({
    actorUserId: viewer!.id,
    action: "product.archive",
    entityType: "product",
    entityId: id,
    before: { status: "active_or_draft", name: product.name },
    after: { status: "archived", name: product.name },
    metadata: actorMeta(viewer!)
  });

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

  await writeAuditLog({
    actorUserId: viewer!.id,
    action: "product.restore",
    entityType: "product",
    entityId: id,
    before: { status: "archived", name: product.name },
    after: { status: "active", name: product.name },
    metadata: actorMeta(viewer!)
  });

  revalidate();
  return { status: "success", message: `${product.name} is active again.` };
}

/**
 * Xoá vĩnh viễn — chỉ manager, chỉ khi đã archived.
 * Gọi RPC `admin_delete_product_forever`: xoá inventory movements + balances
 * của mọi variant, rồi xoá product (cascade variant/media/category).
 * Đơn hàng/invoice cũ giữ snapshot (product_id/variant_id set null).
 */
export async function deleteProductForeverAction(
  _prev: AdminFormState,
  formData: FormData
): Promise<AdminFormState> {
  const { viewer, error: denied } = await guard("admin-product", true);
  if (denied) return denied;

  const id = String(formData.get("id") ?? "").trim();
  if (!id) return fail("Missing product id.");

  const supabase = createAdminClient();
  const { data: product } = await supabase.from("products").select("name, status").eq("id", id).maybeSingle();
  if (!product) return fail("Product not found.");
  if (product.status !== "archived") {
    return fail("Archive the product first, then delete it forever.");
  }

  const { error } = await supabase.rpc("admin_delete_product_forever", {
    p_product_id: id
  });

  if (error) {
    const msg = error.message ?? "";
    if (msg.includes("Archive the product first")) {
      return fail("Archive the product first, then delete it forever.");
    }
    if (msg.includes("Product not found")) return fail("Product not found.");
    if (msg.includes("Could not find the function") || error.code === "PGRST202") {
      return fail(
        "Database is missing admin_delete_product_forever. Apply migration 20260727120000_admin_delete_product_forever.sql."
      );
    }
    return fail(msg);
  }

  await writeAuditLog({
    actorUserId: viewer!.id,
    action: "product.delete_forever",
    entityType: "product",
    entityId: id,
    before: { name: product.name, status: product.status },
    after: null,
    metadata: actorMeta(viewer!)
  });

  revalidate();
  return {
    status: "success",
    message: `Deleted ${product.name} permanently (including inventory).`
  };
}
