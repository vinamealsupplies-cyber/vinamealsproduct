"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

// Ô search trên header. Trước đây là <form action="/products"> thuần: submit
// gốc vẫn chạy nhưng phải full reload, và trên vài bàn phím mobile phím
// Enter/"Search" không luôn kích hoạt submit. Chuyển sang client + router.push
// để Enter và nút bấm đều search ngay, điều hướng client-side (nhanh hơn).
export function HeaderSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const q = query.trim();
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
