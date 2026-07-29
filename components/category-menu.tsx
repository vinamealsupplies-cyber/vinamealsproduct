"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import type { CategoryNode } from "@/lib/category-types";

// Dropdown Categories. Dùng button + panel (không dùng <details controlled>)
// vì open={state} trên <details> hay xung đột với toggle native → bấm không mở.
export function CategoryMenu({ categories }: { categories: CategoryNode[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const panelId = useId();
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
    <div className={`category-menu${open ? " is-open" : ""}`} ref={ref}>
      <button
        type="button"
        className="category-menu-trigger"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        Categories <ChevronDown size={16} aria-hidden="true" />
      </button>
      {open ? (
        <div className="category-dropdown" id={panelId} role="menu">
          {categories.length ? (
            categories.map((category) => (
              <div className="category-group" key={category.id}>
                <Link
                  className="category-parent"
                  href={`/products?category=${category.slug}`}
                  role="menuitem"
                  onClick={() => setOpen(false)}
                >
                  {category.name}
                </Link>
                {category.children.map((child) => (
                  <Link
                    key={child.id}
                    href={`/products?category=${child.slug}`}
                    role="menuitem"
                    onClick={() => setOpen(false)}
                  >
                    {child.name}
                  </Link>
                ))}
              </div>
            ))
          ) : (
            <p className="category-empty field-hint">No categories yet. Add them in Admin → Categories.</p>
          )}
          <div className="category-promo">
            <span>For cafés and markets</span>
            <strong>Wholesale pricing</strong>
            <Link href="/wholesale" onClick={() => setOpen(false)}>
              Learn more
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
