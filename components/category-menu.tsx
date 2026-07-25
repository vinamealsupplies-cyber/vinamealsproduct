"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import type { CategoryNode } from "@/lib/data/categories";

// Dropdown Categories trên thanh nav. Dùng <details> để vẫn hoạt động khi
// chưa hydrate (progressive enhancement), nhưng thêm xử lý client để tự đóng
// khi bấm ra ngoài hoặc nhấn Escape — điều mà <details> thuần không có.
// Dữ liệu lấy từ Supabase nên category thêm ở admin hiện ra ngay.
export function CategoryMenu({ categories }: { categories: CategoryNode[] }) {
  const ref = useRef<HTMLDetailsElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <details
      className="category-menu"
      ref={ref}
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>
        Categories <ChevronDown size={16} aria-hidden="true" />
      </summary>
      <div className="category-dropdown">
        {categories.map((category) => (
          <div className="category-group" key={category.id}>
            <Link className="category-parent" href={`/products?category=${category.slug}`} onClick={() => setOpen(false)}>
              {category.name}
            </Link>
            {category.children.map((child) => (
              <Link key={child.id} href={`/products?category=${child.slug}`} onClick={() => setOpen(false)}>
                {child.name}
              </Link>
            ))}
          </div>
        ))}
        <div className="category-promo">
          <span>For cafés and markets</span>
          <strong>Wholesale pricing</strong>
          <Link href="/wholesale" onClick={() => setOpen(false)}>Learn more</Link>
        </div>
      </div>
    </details>
  );
}
