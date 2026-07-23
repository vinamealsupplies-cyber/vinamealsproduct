"use client";

import { useState } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { ProductCard } from "@/components/product-card";
import type { Product } from "@/lib/sample-data";

const sortOptions = [
  { value: "featured", label: "Featured" },
  { value: "newest", label: "Newest" },
  { value: "name-asc", label: "Name: A to Z" },
  { value: "name-desc", label: "Name: Z to A" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
  { value: "stock-desc", label: "Stock: high to low" }
];

export function ProductCatalog({
  products,
  initialQuery = "",
  initialCategory = "",
  initialSort = "featured"
}: {
  products: Product[];
  initialQuery?: string;
  initialCategory?: string;
  initialSort?: string;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [category, setCategory] = useState(initialCategory);
  const [sort, setSort] = useState(sortOptions.some((option) => option.value === initialSort) ? initialSort : "featured");
  const categoryOptions = Array.from(new Set(products.map((product) => product.category))).sort();

  // React Compiler (React 19 + Next 16) tự memo hoá — useMemo thủ công ở đây bị
  // rule `react-hooks/preserve-manual-memoization` báo lỗi vì không bảo toàn được.
  const normalizedQuery = query.trim().toLowerCase();
  const matchingProducts = products.filter((product) => {
    const matchesQuery = !normalizedQuery || [product.name, product.sku, product.category, product.shortDescription]
      .some((value) => value.toLowerCase().includes(normalizedQuery));
    const matchesCategory = !category || product.categorySlug === category || product.category.toLowerCase() === category.toLowerCase();
    return matchesQuery && matchesCategory;
  });

  const visibleProducts = [...matchingProducts].sort((a, b) => {
    switch (sort) {
      case "newest": return b.newestRank - a.newestRank;
      case "name-asc": return a.name.localeCompare(b.name);
      case "name-desc": return b.name.localeCompare(a.name);
      case "price-asc": return a.price - b.price;
      case "price-desc": return b.price - a.price;
      case "stock-desc": return b.stock - a.stock;
      default: return Number(b.featured) - Number(a.featured) || b.newestRank - a.newestRank;
    }
  });

  function clearFilters() {
    setQuery("");
    setCategory("");
    setSort("featured");
  }

  return (
    <div className="catalog-layout">
      <aside className="catalog-filters" aria-label="Product filters">
        <div className="filter-heading">
          <strong><SlidersHorizontal size={18} /> Filters</strong>
          {(query || category || sort !== "featured") ? (
            <button type="button" onClick={clearFilters}><X size={15} /> Clear</button>
          ) : null}
        </div>
        <label>
          Search
          <input value={query} onChange={(event) => setQuery(event.target.value)} type="search" placeholder="Product name or SKU" />
        </label>
        <label>
          Category
          <select value={category} onChange={(event) => setCategory(event.target.value)}>
            <option value="">All categories</option>
            {categoryOptions.map((name) => (
              <option key={name} value={name.toLowerCase()}>{name}</option>
            ))}
          </select>
        </label>
        <label>
          Sort by
          <select value={sort} onChange={(event) => setSort(event.target.value)}>
            {sortOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
      </aside>

      <section className="catalog-results" aria-live="polite">
        <div className="catalog-results-head">
          <p><strong>{visibleProducts.length}</strong> product{visibleProducts.length === 1 ? "" : "s"}</p>
          {query ? <span>Matching “{query}”</span> : <span>Browse the full catalog</span>}
        </div>
        {visibleProducts.length ? (
          <div className="product-grid">
            {visibleProducts.map((product) => <ProductCard key={product.id} product={product} />)}
          </div>
        ) : (
          <div className="empty-state">
            <h2>No products found</h2>
            <p>Try a different product name, SKU, or category.</p>
            <button className="button secondary" type="button" onClick={clearFilters}>Reset filters</button>
          </div>
        )}
      </section>
    </div>
  );
}
