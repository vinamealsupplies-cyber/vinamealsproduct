"use client";

import { useState } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";
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
  // Panel filter (category + sort) ẩn mặc định — mở bằng icon cạnh nút Search.
  // Nếu vào trang với category/sort sẵn từ URL thì mở luôn cho người dùng thấy.
  const [showFilters, setShowFilters] = useState(Boolean(initialCategory) || (initialSort !== "" && initialSort !== "featured"));
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

  // Chỉ category + sort mới tính là "đang lọc" — ô search luôn hoạt động bình thường.
  const activeFilters = (category ? 1 : 0) + (sort !== "featured" ? 1 : 0);

  function clearFilters() {
    setCategory("");
    setSort("featured");
  }

  return (
    <div className="catalog">
      <div className="catalog-toolbar">
        <form className="catalog-search" role="search" onSubmit={(event) => event.preventDefault()}>
          <Search size={18} aria-hidden="true" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            type="search"
            aria-label="Search products"
            placeholder="Search by product name or SKU"
          />
          <button type="submit">Search</button>
        </form>
        <button
          type="button"
          className={`catalog-filter-toggle${showFilters ? " active" : ""}`}
          aria-expanded={showFilters}
          aria-controls="catalog-filter-panel"
          aria-label={showFilters ? "Hide filters" : "Show filters"}
          onClick={() => setShowFilters((current) => !current)}
        >
          <SlidersHorizontal size={18} aria-hidden="true" />
          {activeFilters ? <span className="filter-dot" aria-hidden="true" /> : null}
        </button>
      </div>

      {showFilters ? (
        <div className="catalog-filter-panel" id="catalog-filter-panel">
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
          {activeFilters ? (
            <button type="button" className="filter-clear" onClick={clearFilters}>
              <X size={15} /> Clear filters
            </button>
          ) : null}
        </div>
      ) : null}

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
            <button className="button secondary" type="button" onClick={() => { setQuery(""); clearFilters(); }}>Reset search</button>
          </div>
        )}
      </section>
    </div>
  );
}
