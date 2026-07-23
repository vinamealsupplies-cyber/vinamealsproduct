import type { Metadata } from "next";
import { ProductCatalog } from "@/components/product-catalog";
import { products } from "@/lib/sample-data";

export const metadata: Metadata = { title: "Shop all products" };

export default async function ProductsPage({ searchParams }: { searchParams: Promise<{ q?: string; category?: string; sort?: string }> }) {
  const params = await searchParams;
  return (
    <div className="page-shell shell">
      <header className="page-heading">
        <span className="kicker">The full collection</span>
        <h1>Shop all products</h1>
        <p>Search by product name or SKU, filter by category, and sort the catalog.</p>
      </header>
      <ProductCatalog products={products} initialQuery={params.q ?? ""} initialCategory={params.category ?? ""} initialSort={params.sort ?? "featured"} />
    </div>
  );
}
