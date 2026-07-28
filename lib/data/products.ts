import "server-only";

import { createPublicClient } from "@/lib/supabase/public";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Product, ProductMedia } from "@/lib/sample-data";

// Đọc catalog từ Supabase (thay cho dữ liệu hardcode). Giá/mô tả/ảnh lấy trực
// tiếp từ bảng (RLS anon cho phép đọc active); stock lấy từ view
// v_product_listing (inventory_balances không mở cho anon).

type VariantRow = {
  sku: string;
  retail_price: number | string;
  sale_price: number | string | null;
  wholesale_price: number | string | null;
  is_default: boolean;
  is_active: boolean;
};

type MediaRow = {
  media_type: "image" | "video";
  public_url: string | null;
  playback_url: string | null;
  poster_url: string | null;
  alt_text: string | null;
  position: number;
  is_primary: boolean;
  status: string;
};

type CategoryLink = {
  is_primary: boolean;
  categories: { name: string; slug: string } | null;
};

type ProductRow = {
  id: string;
  slug: string;
  name: string;
  short_description: string | null;
  description: string | null;
  featured: boolean;
  published_at: string | null;
  product_variants: VariantRow[];
  product_categories: CategoryLink[];
  product_media: MediaRow[];
};

function num(value: number | string | null | undefined, fallback = 0) {
  const parsed = typeof value === "string" ? Number.parseFloat(value) : value;
  return typeof parsed === "number" && Number.isFinite(parsed) ? parsed : fallback;
}

function mapMedia(rows: MediaRow[]): ProductMedia[] {
  return rows
    .filter((row) => row.status === "ready" && (row.public_url || row.playback_url))
    .sort((a, b) => Number(b.is_primary) - Number(a.is_primary) || a.position - b.position)
    .map((row, index) => ({
      id: `${row.media_type}-${row.position}-${index}`,
      type: row.media_type,
      src: (row.public_url ?? row.playback_url) ?? undefined,
      poster: row.poster_url ?? undefined,
      alt: row.alt_text ?? ""
    }));
}

function mapProduct(row: ProductRow, stockByProduct: Map<string, number>): Product {
  const variants = row.product_variants ?? [];
  const variant = variants.find((item) => item.is_default) ?? variants.find((item) => item.is_active) ?? variants[0];
  const primaryCategory =
    (row.product_categories ?? []).find((link) => link.is_primary)?.categories ??
    (row.product_categories ?? [])[0]?.categories ??
    null;

  const retail = num(variant?.retail_price);
  const rawSale =
    variant?.sale_price == null || variant.sale_price === ""
      ? null
      : num(variant.sale_price);
  // Sale chỉ áp dụng khi có giá và thấp hơn retail.
  const onSale = rawSale !== null && rawSale >= 0 && rawSale < retail;
  const price = onSale ? rawSale : retail;

  // Public catalog: không lộ wholesale_price (cột không grant cho anon).
  // wholesalePrice trên type chỉ dùng nội bộ/admin; storefront luôn = price.
  const wholesaleFromDb =
    variant && "wholesale_price" in variant && variant.wholesale_price != null
      ? num(variant.wholesale_price as number | string)
      : null;

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    sku: variant?.sku ?? "",
    category: primaryCategory?.name ?? "Uncategorized",
    categorySlug: primaryCategory?.slug ?? "",
    price,
    compareAtPrice: onSale ? retail : null,
    wholesalePrice: wholesaleFromDb ?? price,
    stock: Math.max(0, Math.round(stockByProduct.get(row.id) ?? 0)),
    featured: row.featured,
    // Dùng mốc published_at (epoch giây) làm rank "mới nhất": mới hơn = lớn hơn.
    newestRank: row.published_at ? Math.floor(new Date(row.published_at).getTime() / 1000) : 0,
    shortDescription: row.short_description ?? "",
    description: row.description ?? "",
    media: mapMedia(row.product_media ?? [])
  };
}

// Cột giá vốn/giá sỉ KHÔNG được cấp cho anon (xem migration 20260724120000),
// nên truy vấn công khai không được đụng tới `wholesale_price` — hỏi tới là
// PostgREST trả 42501 và cả trang chết. Giá sỉ chỉ đọc ở luồng admin bên dưới.
// sale_price là giá khuyến mãi công khai — được grant cho anon.
const PUBLIC_SELECT = `id, slug, name, short_description, description, featured, published_at,
         product_variants ( sku, retail_price, sale_price, is_default, is_active ),
         product_categories ( is_primary, categories ( name, slug ) ),
         product_media ( media_type, public_url, playback_url, poster_url, alt_text, position, is_primary, status )`;

const ADMIN_SELECT = PUBLIC_SELECT.replace(
  "product_variants ( sku, retail_price, sale_price, is_default, is_active )",
  "product_variants ( sku, retail_price, sale_price, wholesale_price, is_default, is_active )"
);

async function loadProducts(
  supabase: ReturnType<typeof createPublicClient>,
  select: string,
  onlyActive: boolean
): Promise<Product[]> {
  const query = supabase.from("products").select(select);
  const [{ data: rows, error }, { data: listing }] = await Promise.all([
    onlyActive ? query.eq("status", "active") : query,
    supabase.from("v_product_listing").select("product_id, available_quantity")
  ]);

  if (error) throw new Error(`Failed to load products: ${error.message}`);

  const stockByProduct = new Map<string, number>();
  for (const item of listing ?? []) {
    stockByProduct.set(item.product_id as string, num(item.available_quantity as number));
  }

  return ((rows ?? []) as unknown as ProductRow[])
    .map((row) => mapProduct(row, stockByProduct))
    .sort((a, b) => Number(b.featured) - Number(a.featured) || b.newestRank - a.newestRank);
}

/** Catalog cho storefront. `wholesalePrice` = giá bán lẻ (không lộ giá sỉ). */
export async function getProducts(): Promise<Product[]> {
  return loadProducts(createPublicClient(), PUBLIC_SELECT, true);
}

/**
 * Catalog cho khu admin — có giá sỉ thật. Dùng service role đúng như thiết kế
 * trong migration gốc: "Admin screens needing wholesale/cost fields must use
 * verified server routes/service-role projections".
 * Chỉ gọi từ trang đã qua gate staff (app/admin/layout.tsx).
 */
export async function getAdminProducts(): Promise<Product[]> {
  return loadProducts(createAdminClient() as ReturnType<typeof createPublicClient>, ADMIN_SELECT, false);
}

export async function getProductBySlug(slug: string): Promise<Product | undefined> {
  const products = await getProducts();
  return products.find((product) => product.slug === slug);
}
