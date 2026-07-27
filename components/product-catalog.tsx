"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { ProductCard } from "@/components/product-card";
import { SearchHistoryPanel } from "@/components/search-history-panel";
import type { CategoryNode } from "@/lib/data/categories";
import type { Product } from "@/lib/sample-data";
import {
  clearSearchHistory,
  pushSearchHistory,
  readSearchHistory,
  removeSearchHistoryItem
} from "@/lib/search-history";

const sortOptions = [
  { value: "featured", label: "Featured" },
  { value: "newest", label: "Newest" },
  { value: "name-asc", label: "Name: A to Z" },
  { value: "name-desc", label: "Name: Z to A" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
  { value: "stock-desc", label: "Stock: high to low" }
];

/** Resolve slug/name from URL/dropdown → set of product categorySlug + names that match. */
function matchKeysForCategory(categories: CategoryNode[], selected: string): Set<string> {
  const needle = selected.trim().toLowerCase();
  if (!needle) return new Set();

  for (const parent of categories) {
    if (parent.slug.toLowerCase() === needle || parent.name.toLowerCase() === needle) {
      const keys = new Set<string>([parent.slug.toLowerCase(), parent.name.toLowerCase()]);
      for (const child of parent.children) {
        keys.add(child.slug.toLowerCase());
        keys.add(child.name.toLowerCase());
      }
      return keys;
    }
    for (const child of parent.children) {
      if (child.slug.toLowerCase() === needle || child.name.toLowerCase() === needle) {
        return new Set([child.slug.toLowerCase(), child.name.toLowerCase()]);
      }
    }
  }

  // Fallback: exact string from URL even if not in tree yet.
  return new Set([needle]);
}

function productInCategory(product: Product, keys: Set<string>) {
  if (!keys.size) return true;
  return keys.has(product.categorySlug.toLowerCase()) || keys.has(product.category.toLowerCase());
}

function isOnSale(product: Product) {
  return product.compareAtPrice != null && product.compareAtPrice > product.price;
}

export function ProductCatalog({
  products,
  categories = [],
  initialQuery = "",
  initialCategory = "",
  initialSort = "featured",
  initialSaleOnly = false
}: {
  products: Product[];
  categories?: CategoryNode[];
  initialQuery?: string;
  initialCategory?: string;
  initialSort?: string;
  initialSaleOnly?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchWrapRef = useRef<HTMLDivElement>(null);

  const [query, setQuery] = useState(initialQuery);
  const [category, setCategory] = useState(initialCategory);
  const [saleOnly, setSaleOnly] = useState(initialSaleOnly);
  const [sort, setSort] = useState(
    sortOptions.some((option) => option.value === initialSort) ? initialSort : "featured"
  );
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [openHistory, setOpenHistory] = useState(false);

  // Lịch sử được nạp lúc focus (xem onFocus của ô search) nên không cần effect mount.

  useEffect(() => {
    if (!openHistory) return;
    function onPointerDown(event: PointerEvent) {
      if (searchWrapRef.current && !searchWrapRef.current.contains(event.target as Node)) {
        setOpenHistory(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [openHistory]);
  // Panel filter: mở khi URL có category/sort/sale khác mặc định.
  const [showFilters, setShowFilters] = useState(
    Boolean(initialCategory) ||
      initialSaleOnly ||
      (initialSort !== "" && initialSort !== "featured")
  );

  // Đồng bộ khi URL đổi (bấm Shop all / Categories / Sale / New arrivals).
  //
  // Trang là server component đọc searchParams rồi truyền xuống qua props, nên
  // props CHÍNH LÀ trạng thái URL — trước đây có hai effect làm cùng một việc
  // (một đọc searchParams, một đọc props). Giờ gộp lại và chỉnh state ngay
  // trong render: setState trong effect gây cascading render.
  const urlSignature = `${initialQuery}|${initialCategory}|${initialSort}|${initialSaleOnly}`;
  const [syncedSignature, setSyncedSignature] = useState(urlSignature);

  if (urlSignature !== syncedSignature) {
    setSyncedSignature(urlSignature);
    setQuery(initialQuery);
    setCategory(initialCategory);
    setSaleOnly(initialSaleOnly);
    setSort(sortOptions.some((option) => option.value === initialSort) ? initialSort : "featured");

    const hasFilter =
      Boolean(initialCategory) || initialSaleOnly || (initialSort !== "" && initialSort !== "featured");
    if (hasFilter) setShowFilters(true);
    else if (!initialQuery) setShowFilters(false);
  }

  function pushCatalogParams(next: {
    q?: string;
    category?: string;
    sort?: string;
    saleOnly?: boolean;
    /** Ghi lịch sử search khi submit / chọn history (không ghi khi chỉ đổi filter). */
    recordSearch?: boolean;
  }) {
    const params = new URLSearchParams();
    const q = (next.q ?? query).trim();
    const cat = next.category ?? category;
    const s = next.sort ?? sort;
    const sale = next.saleOnly ?? saleOnly;
    if (q) params.set("q", q);
    if (cat) params.set("category", cat);
    if (sale) params.set("sale", "1");
    if (s && s !== "featured") params.set("sort", s);
    if (next.recordSearch && q) {
      setSearchHistory(pushSearchHistory(q));
      setOpenHistory(false);
    }
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  const categoryKeys = matchKeysForCategory(categories, category);
  const normalizedQuery = query.trim().toLowerCase();

  const matchingProducts = products.filter((product) => {
    const matchesQuery =
      !normalizedQuery ||
      [product.name, product.sku, product.category, product.shortDescription].some((value) =>
        value.toLowerCase().includes(normalizedQuery)
      );
    const matchesCategory = productInCategory(product, categoryKeys);
    const matchesSale = !saleOnly || isOnSale(product);
    return matchesQuery && matchesCategory && matchesSale;
  });

  const visibleProducts = [...matchingProducts].sort((a, b) => {
    switch (sort) {
      case "newest":
        return b.newestRank - a.newestRank;
      case "name-asc":
        return a.name.localeCompare(b.name);
      case "name-desc":
        return b.name.localeCompare(a.name);
      case "price-asc":
        return a.price - b.price;
      case "price-desc":
        return b.price - a.price;
      case "stock-desc":
        return b.stock - a.stock;
      default:
        return Number(b.featured) - Number(a.featured) || b.newestRank - a.newestRank;
    }
  });

  const activeFilters =
    (category ? 1 : 0) + (saleOnly ? 1 : 0) + (sort !== "featured" ? 1 : 0);

  // Options từ cây category (slug) — khớp link header dropdown.
  const categoryOptions: { value: string; label: string }[] = [];
  for (const parent of categories) {
    categoryOptions.push({ value: parent.slug, label: parent.name });
    for (const child of parent.children) {
      categoryOptions.push({ value: child.slug, label: `— ${child.name}` });
    }
  }
  // Fallback nếu chưa load tree: lấy từ sản phẩm.
  if (!categoryOptions.length) {
    for (const name of Array.from(new Set(products.map((p) => p.category))).sort()) {
      const sample = products.find((p) => p.category === name);
      categoryOptions.push({ value: sample?.categorySlug || name.toLowerCase(), label: name });
    }
  }

  function clearFilters() {
    setCategory("");
    setSaleOnly(false);
    setSort("featured");
    pushCatalogParams({ category: "", saleOnly: false, sort: "featured" });
  }

  function clearAll() {
    setQuery("");
    setCategory("");
    setSaleOnly(false);
    setSort("featured");
    setShowFilters(false);
    router.push(pathname, { scroll: false });
  }

  const categoryLabel =
    categoryOptions.find((option) => option.value === category)?.label.replace(/^—\s*/, "") ||
    category;

  const hasActiveContext = Boolean(query || category || saleOnly);

  return (
    <div className="catalog">
      <div className="catalog-toolbar">
        <div className="catalog-search-wrap" ref={searchWrapRef}>
          <form
            className="catalog-search"
            role="search"
            onSubmit={(event) => {
              event.preventDefault();
              pushCatalogParams({ q: query, recordSearch: true });
            }}
          >
            <Search size={18} aria-hidden="true" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onFocus={() => {
                setSearchHistory(readSearchHistory());
                setOpenHistory(true);
              }}
              type="search"
              autoComplete="off"
              aria-label="Search products"
              // role="combobox" để aria-expanded hợp lệ (input mặc định là textbox).
              role="combobox"
              aria-controls="catalog-search-history"
              aria-autocomplete="list"
              aria-expanded={openHistory && searchHistory.length > 0}
              placeholder="Search by product name or SKU"
            />
            <button type="submit">Search</button>
          </form>
          {openHistory ? (
            <SearchHistoryPanel
              id="catalog-search-history"
              items={searchHistory}
              onPick={(item) => {
                setQuery(item);
                pushCatalogParams({ q: item, recordSearch: true });
              }}
              onRemove={(item) => setSearchHistory(removeSearchHistoryItem(item))}
              onClearAll={() => setSearchHistory(clearSearchHistory())}
            />
          ) : null}
        </div>
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
            <select
              value={category}
              onChange={(event) => {
                const next = event.target.value;
                setCategory(next);
                pushCatalogParams({ category: next });
              }}
            >
              <option value="">All categories</option>
              {categoryOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Sort by
            <select
              value={sort}
              onChange={(event) => {
                const next = event.target.value;
                setSort(next);
                pushCatalogParams({ sort: next });
              }}
            >
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="catalog-sale-toggle">
            <input
              type="checkbox"
              checked={saleOnly}
              onChange={(event) => {
                const next = event.target.checked;
                setSaleOnly(next);
                pushCatalogParams({ saleOnly: next });
              }}
            />
            On sale only
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
          <p>
            <strong>{visibleProducts.length}</strong> product{visibleProducts.length === 1 ? "" : "s"}
            {saleOnly ? " on sale" : ""}
          </p>
          {hasActiveContext ? (
            <span>
              {saleOnly ? <>Sale items</> : null}
              {saleOnly && (query || category) ? " · " : null}
              {query ? <>Matching “{query}”</> : null}
              {query && category ? " · " : null}
              {category ? <>Category: {categoryLabel}</> : null}
              {" · "}
              <button type="button" className="text-link" onClick={clearAll}>
                Show all
              </button>
            </span>
          ) : (
            <span>Browse the full catalog</span>
          )}
        </div>
        {visibleProducts.length ? (
          <div className="product-grid">
            {visibleProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <h2>{saleOnly ? "No sale products right now" : "No products found"}</h2>
            <p>
              {saleOnly
                ? "Set a sale price on products in Admin to list them here."
                : "Try a different product name, SKU, or category."}
            </p>
            <button className="button secondary" type="button" onClick={clearAll}>
              Show all products
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
