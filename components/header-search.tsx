"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { SearchHistoryPanel } from "@/components/search-history-panel";
import {
  clearSearchHistory,
  pushSearchHistory,
  readSearchHistory,
  removeSearchHistoryItem
} from "@/lib/search-history";

// Ô search trên header — đồng bộ URL + lịch sử tìm kiếm (localStorage, max 20).
export function HeaderSearch() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const wrapRef = useRef<HTMLDivElement>(null);
  // URL là nguồn sự thật cho ô search.
  //   /products        -> lấy ?q
  //   /products/<slug> -> null: giữ nguyên chữ người dùng đang gõ
  //   trang khác       -> xoá trắng
  const urlQuery =
    pathname === "/products"
      ? searchParams.get("q") ?? ""
      : pathname.startsWith("/products")
        ? null
        : "";

  const [query, setQuery] = useState(urlQuery ?? "");
  const [history, setHistory] = useState<string[]>([]);
  const [openHistory, setOpenHistory] = useState(false);
  const [syncedQuery, setSyncedQuery] = useState(urlQuery);

  // Đồng bộ ngay trong render thay vì trong effect: setState trong effect gây
  // cascading render (rule react-hooks/set-state-in-effect). Đây là cách React
  // khuyến nghị khi cần chỉnh state lúc props/URL đổi.
  if (urlQuery !== null && urlQuery !== syncedQuery) {
    setSyncedQuery(urlQuery);
    setQuery(urlQuery);
  }

  // Lịch sử được nạp lúc focus (xem onFocus bên dưới) nên không cần effect mount.

  useEffect(() => {
    if (!openHistory) return;
    function onPointerDown(event: PointerEvent) {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) {
        setOpenHistory(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [openHistory]);

  function goSearch(raw: string) {
    const q = raw.trim();
    if (q) setHistory(pushSearchHistory(q));
    setOpenHistory(false);
    router.push(q ? `/products?q=${encodeURIComponent(q)}` : "/products");
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    goSearch(query);
  }

  return (
    <div className="header-search-wrap" ref={wrapRef}>
      <form className="header-search" role="search" onSubmit={handleSubmit}>
        <Search size={18} aria-hidden="true" />
        <input
          name="q"
          type="search"
          enterKeyHint="search"
          autoComplete="off"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => {
            setHistory(readSearchHistory());
            setOpenHistory(true);
          }}
          placeholder="Search products"
          aria-label="Search products"
          // role="combobox" để aria-expanded hợp lệ (input mặc định là textbox).
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={openHistory && history.length > 0}
        />
        <button type="submit">Search</button>
      </form>
      {openHistory ? (
        <SearchHistoryPanel
          items={history}
          onPick={(item) => {
            setQuery(item);
            goSearch(item);
          }}
          onRemove={(item) => setHistory(removeSearchHistoryItem(item))}
          onClearAll={() => setHistory(clearSearchHistory())}
        />
      ) : null}
    </div>
  );
}
