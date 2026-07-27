import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

// Sản phẩm cho khu quản trị: đầy đủ trường để sửa (giá vốn, giá sỉ, SKU, tồn
// kho, trạng thái) — khác với `lib/data/products.ts` vốn phục vụ storefront và
// cố ý không lộ giá vốn/giá sỉ. Đọc bằng service role; trang gọi hàm này đã qua
// gate staff ở app/admin/layout.tsx.

export type ProductStatus = "draft" | "active" | "archived";

export type AdminProduct = {
  id: string;
  slug: string;
  productHandle: string;
  name: string;
  shortDescription: string;
  description: string;
  status: ProductStatus;
  featured: boolean;
  categoryId: string | null;
  categoryName: string;
  variantId: string | null;
  variantName: string;
  sku: string;
  barcode: string;
  retailPrice: number;
  wholesalePrice: number | null;
  costPrice: number;
  taxable: boolean;
  trackInventory: boolean;
  onHand: number;
  reorderPoint: number;
  /** Đã từng phát sinh tồn kho → không xoá cứng được (FK on delete restrict). */
  hasMovements: boolean;
};

type DbVariant = {
  id: string;
  variant_name: string;
  sku: string;
  barcode: string | null;
  retail_price: number | string;
  wholesale_price: number | string | null;
  cost_price: number | string;
  taxable: boolean;
  track_inventory: boolean;
  is_default: boolean;
  is_active: boolean;
};

type DbRow = {
  id: string;
  slug: string;
  product_handle: string;
  name: string;
  short_description: string | null;
  description: string | null;
  status: ProductStatus;
  featured: boolean;
  product_variants: DbVariant[] | null;
  product_categories: { is_primary: boolean; categories: { id: string; name: string } | null }[] | null;
};

function num(value: number | string | null | undefined) {
  const parsed = typeof value === "string" ? Number.parseFloat(value) : value;
  return typeof parsed === "number" && Number.isFinite(parsed) ? parsed : 0;
}

const SELECT = `id, slug, product_handle, name, short_description, description, status, featured,
   product_variants ( id, variant_name, sku, barcode, retail_price, wholesale_price, cost_price, taxable, track_inventory, is_default, is_active ),
   product_categories ( is_primary, categories ( id, name ) )`;

function pickVariant(row: DbRow) {
  const variants = row.product_variants ?? [];
  return variants.find((item) => item.is_default) ?? variants.find((item) => item.is_active) ?? variants[0];
}

function mapRow(
  row: DbRow,
  stock: Map<string, { onHand: number; reorderPoint: number }>,
  movementVariantIds: Set<string>
): AdminProduct {
  const variant = pickVariant(row);
  const link =
    (row.product_categories ?? []).find((item) => item.is_primary) ?? (row.product_categories ?? [])[0];
  const balance = variant ? stock.get(variant.id) : undefined;

  return {
    id: row.id,
    slug: row.slug,
    productHandle: row.product_handle,
    name: row.name,
    shortDescription: row.short_description ?? "",
    description: row.description ?? "",
    status: row.status,
    featured: row.featured,
    categoryId: link?.categories?.id ?? null,
    categoryName: link?.categories?.name ?? "Uncategorized",
    variantId: variant?.id ?? null,
    variantName: variant?.variant_name ?? "",
    sku: variant?.sku ?? "",
    barcode: variant?.barcode ?? "",
    retailPrice: num(variant?.retail_price),
    wholesalePrice: variant?.wholesale_price == null ? null : num(variant.wholesale_price),
    costPrice: num(variant?.cost_price),
    taxable: variant?.taxable ?? true,
    trackInventory: variant?.track_inventory ?? true,
    onHand: balance?.onHand ?? 0,
    reorderPoint: balance?.reorderPoint ?? 0,
    hasMovements: variant ? movementVariantIds.has(variant.id) : false
  };
}

async function loadStockAndMovements(variantIds: string[]) {
  const supabase = createAdminClient();
  const stock = new Map<string, { onHand: number; reorderPoint: number }>();
  const movementVariantIds = new Set<string>();
  if (!variantIds.length) return { stock, movementVariantIds };

  const [balances, movements] = await Promise.all([
    supabase
      .from("inventory_balances")
      .select("variant_id, quantity_on_hand, reorder_point")
      .in("variant_id", variantIds),
    supabase.from("inventory_movements").select("variant_id").in("variant_id", variantIds)
  ]);

  for (const row of (balances.data ?? []) as {
    variant_id: string;
    quantity_on_hand: number | string;
    reorder_point: number | string;
  }[]) {
    const current = stock.get(row.variant_id) ?? { onHand: 0, reorderPoint: 0 };
    stock.set(row.variant_id, {
      onHand: current.onHand + num(row.quantity_on_hand),
      reorderPoint: num(row.reorder_point)
    });
  }
  for (const row of (movements.data ?? []) as { variant_id: string }[]) {
    movementVariantIds.add(row.variant_id);
  }

  return { stock, movementVariantIds };
}

export async function getAdminProductList(): Promise<AdminProduct[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.from("products").select(SELECT).order("name");
  if (error) throw new Error(`Failed to load products: ${error.message}`);

  const rows = (data ?? []) as unknown as DbRow[];
  const variantIds = rows.map((row) => pickVariant(row)?.id).filter((id): id is string => Boolean(id));
  const { stock, movementVariantIds } = await loadStockAndMovements(variantIds);

  return rows.map((row) => mapRow(row, stock, movementVariantIds));
}

export async function getAdminProductById(id: string): Promise<AdminProduct | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.from("products").select(SELECT).eq("id", id).maybeSingle();
  if (error || !data) return null;

  const row = data as unknown as DbRow;
  const variantId = pickVariant(row)?.id;
  const { stock, movementVariantIds } = await loadStockAndMovements(variantId ? [variantId] : []);
  return mapRow(row, stock, movementVariantIds);
}
