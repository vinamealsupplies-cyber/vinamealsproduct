"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";

// Ô search trên header — đồng bộ với ?q= trên URL (Shop all / clear filter).
export function HeaderSearch() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (pathname === "/products") {
      setQuery(searchParams.get("q") ?? "");
    } else if (!pathname.startsWith("/products")) {
      // Rời catalog → không giữ chữ search cũ trên header.
      setQuery("");
    }
  }, [pathname, searchParams]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const q = query.trim();
    // Search all: chỉ ?q=, không giữ category/sort cũ.
    router.push(q ? `/products?q=${encodeURIComponent(q)}` : "/products");
  }

  return (
    <form className="header-search" role="search" onSubmit={handleSubmit}>
      <Search size={18} aria-hidden="true" />
      <input
        name="q"
        type="search"
        enterKeyHint="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search products"
        aria-label="Search products"
      />
      <button type="submit">Search</button>
    </form>
  );
}
