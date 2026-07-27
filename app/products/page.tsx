import type { Metadata } from "next";
import { Suspense } from "react";
import { ProductCatalog } from "@/components/product-catalog";
import { getStorefrontCategories } from "@/lib/data/categories";
import { getProducts } from "@/lib/data/products";

export const metadata: Metadata = { title: "Shop all products" };

export default async function ProductsPage({
  searchParams
}: {
  searchParams: Promise<{ q?: string; category?: string; sort?: string }>;
}) {
  const [params, products, categories] = await Promise.all([
    searchParams,
    getProducts(),
    getStorefrontCategories()
  ]);

  const heading =
    params.category && !params.q
      ? "Shop by category"
      : params.q
        ? "Search results"
        : "Shop all products";

  return (
    <div className="page-shell shell">
      <header className="page-heading">
        <span className="kicker">The full collection</span>
        <h1>{heading}</h1>
        <p>Search by product name or SKU, filter by category, and sort the catalog.</p>
      </header>
      {/* Suspense: useSearchParams trong ProductCatalog cần boundary. */}
      <Suspense fallback={<p className="field-hint">Loading catalog…</p>}>
        <ProductCatalog
          products={products}
          categories={categories}
          initialQuery={params.q ?? ""}
          initialCategory={params.category ?? ""}
          initialSort={params.sort ?? "featured"}
        />
      </Suspense>
    </div>
  );
}
