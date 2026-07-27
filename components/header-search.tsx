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
  const [query, setQuery] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [openHistory, setOpenHistory] = useState(false);

  useEffect(() => {
    setHistory(readSearchHistory());
  }, []);

  useEffect(() => {
    if (pathname === "/products") {
      setQuery(searchParams.get("q") ?? "");
    } else if (!pathname.startsWith("/products")) {
      setQuery("");
    }
  }, [pathname, searchParams]);

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
