import type { Metadata } from "next";
import { Suspense } from "react";
import { ProductCatalog } from "@/components/product-catalog";
import { getStorefrontCategories } from "@/lib/data/categories";
import { getProducts } from "@/lib/data/products";

export const metadata: Metadata = { title: "Shop all products" };

export default async function ProductsPage({
  searchParams
}: {
  searchParams: Promise<{ q?: string; category?: string; sort?: string; sale?: string }>;
}) {
  const [params, products, categories] = await Promise.all([
    searchParams,
    getProducts(),
    getStorefrontCategories()
  ]);

  const saleOnly = params.sale === "1" || params.sale === "true";
  const sort = params.sort ?? "featured";
  // Key buộc remount khi query đổi — tránh catalog giữ state cũ sau soft nav.
  const catalogKey = [
    params.q ?? "",
    params.category ?? "",
    sort,
    saleOnly ? "1" : "0"
  ].join("|");

  const heading = saleOnly
    ? "Sale"
    : params.sort === "newest" && !params.q && !params.category
      ? "New arrivals"
      : params.category && !params.q
        ? "Shop by category"
        : params.q
          ? "Search results"
          : "Shop all products";

  return (
    <div className="page-shell shell">
      <header className="page-heading">
        <span className="kicker">
          {saleOnly
            ? "Limited-time deals"
            : params.sort === "newest"
              ? "Just added"
              : "The full collection"}
        </span>
        <h1>{heading}</h1>
        <p>
          {saleOnly
            ? "Products with an active sale price — retail is struck through on each card."
            : params.sort === "newest"
              ? "Newest products first — sorted by publish date."
              : "Search by product name or SKU, filter by category, and sort the catalog."}
        </p>
      </header>
      {/* Suspense: useSearchParams trong ProductCatalog cần boundary. */}
      <Suspense fallback={<p className="field-hint">Loading catalog…</p>}>
        <ProductCatalog
          key={catalogKey}
          products={products}
          categories={categories}
          initialQuery={params.q ?? ""}
          initialCategory={params.category ?? ""}
          initialSort={sort}
          initialSaleOnly={saleOnly}
        />
      </Suspense>
    </div>
  );
}
