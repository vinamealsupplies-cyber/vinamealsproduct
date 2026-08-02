import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

// Tồn kho đọc từ view v_inventory_detail (đã gộp sẵn variant, kho, giá vốn,
// giá trị tồn và trạng thái low/out of stock).

export type InventoryRow = {
  variantId: string;
  locationId: string;
  productName: string;
  variantName: string;
  sku: string;
  barcode: string | null;
  locationCode: string;
  categoryName: string | null;
  onHand: number;
  reserved: number;
  available: number;
  /** Giá nhập / unit cost — dùng tính inventory value. */
  costPrice: number;
  /** Giá bán lẻ (retail). */
  retailPrice: number;
  inventoryValue: number;
  stockStatus: string;
  /** Trạng thái product (active/draft/archived). Archived → stockStatus out_of_stock. */
  productStatus: string;
};

type DbRow = {
  variant_id: string;
  location_id: string;
  product_name: string;
  variant_name: string;
  sku: string;
  barcode: string | null;
  location_code: string;
  primary_category_name: string | null;
  quantity_on_hand: number | string;
  quantity_reserved: number | string;
  available_quantity: number | string;
  cost_price: number | string;
  retail_price: number | string;
  inventory_value: number | string;
  stock_status: string;
  product_status: string | null;
};

function num(value: number | string | null | undefined) {
  const parsed = typeof value === "string" ? Number.parseFloat(value) : value;
  return typeof parsed === "number" && Number.isFinite(parsed) ? parsed : 0;
}

export async function getInventoryForStaff(): Promise<InventoryRow[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("v_inventory_detail")
    .select(
      "variant_id, location_id, product_name, variant_name, sku, barcode, location_code, primary_category_name, quantity_on_hand, quantity_reserved, available_quantity, cost_price, retail_price, inventory_value, stock_status, product_status"
    )
    .order("product_name");

  if (error) throw new Error(`Failed to load inventory: ${error.message}`);

  return ((data ?? []) as DbRow[]).map((row) => {
    const productStatus = row.product_status ?? "active";
    // Product archived → luôn Out of stock trên inventory (không bán trên storefront).
    const stockStatus =
      productStatus === "archived" ? "out_of_stock" : row.stock_status;

    return {
      variantId: row.variant_id,
      locationId: row.location_id,
      productName: row.product_name,
      variantName: row.variant_name,
      sku: row.sku,
      barcode: row.barcode,
      locationCode: row.location_code,
      categoryName: row.primary_category_name,
      onHand: num(row.quantity_on_hand),
      reserved: num(row.quantity_reserved),
      available: num(row.available_quantity),
      costPrice: num(row.cost_price),
      retailPrice: num(row.retail_price),
      inventoryValue: num(row.inventory_value),
      stockStatus,
      productStatus
    };
  });
}

export type MovementRow = {
  id: string;
  createdAt: string;
  sku: string;
  productName: string;
  movementType: string;
  quantityChange: number;
  reason: string | null;
  /** Ai thực hiện thay đổi — lấy từ profiles qua created_by. */
  changedBy: string;
};

type MovementDbRow = {
  id: string;
  created_at: string;
  movement_type: string;
  quantity_change: number | string;
  reason: string | null;
  product_variants: { sku: string; products: { name: string } | null } | null;
  profiles: { full_name: string | null; email: string | null } | null;
};

const MOVEMENT_SELECT =
  "id, created_at, movement_type, quantity_change, reason, product_variants ( sku, products ( name ) ), profiles!inventory_movements_created_by_fkey ( full_name, email )";

function mapMovement(row: MovementDbRow): MovementRow {
  return {
    id: row.id,
    createdAt: row.created_at,
    sku: row.product_variants?.sku ?? "—",
    productName: row.product_variants?.products?.name ?? "—",
    movementType: row.movement_type,
    quantityChange: num(row.quantity_change),
    reason: row.reason,
    // Movement do hệ thống sinh (bán hàng, đặt chỗ) không có người thực hiện.
    changedBy: row.profiles?.full_name || row.profiles?.email || "System"
  };
}

/** Lịch sử điều chỉnh gần đây (mọi mặt hàng) — hiện khi chưa chọn dòng nào. */
export async function getRecentMovements(limit = 15): Promise<MovementRow[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("inventory_movements")
    .select(MOVEMENT_SELECT)
    .order("created_at", { ascending: false })
    .limit(limit);

  return ((data ?? []) as unknown as MovementDbRow[]).map(mapMovement);
}

/** Lịch sử thay đổi của ĐÚNG một mặt hàng tại một kho. */
export async function getMovementsForVariant(
  variantId: string,
  locationId: string,
  limit = 50
): Promise<MovementRow[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("inventory_movements")
    .select(MOVEMENT_SELECT)
    .eq("variant_id", variantId)
    .eq("location_id", locationId)
    .order("created_at", { ascending: false })
    .limit(limit);

  return ((data ?? []) as unknown as MovementDbRow[]).map(mapMovement);
}
