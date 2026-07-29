"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Check, LogIn, Minus, PackageCheck, Plus, ShoppingBag } from "lucide-react";
import { useCart } from "@/lib/cart";
import type { Product } from "@/lib/sample-data";
import { usd } from "@/lib/format";

export function ProductCard({ product }: { product: Product }) {
  const image = product.media.find((item) => item.type === "image" && item.src);
  const lowStock = product.stock > 0 && product.stock <= 10;
  const { add, signedIn, ready } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [justAdded, setJustAdded] = useState(false);
  const [prevStock, setPrevStock] = useState(product.stock);
  const loginHref = `/login?next=${encodeURIComponent(`/products/${product.slug}`)}`;

  // Stock đổi (giảm / hết) → kẹp số lượng ngay trong render, thay cho setState
  // trong effect (rule react-hooks/set-state-in-effect: cascading render).
  if (product.stock !== prevStock) {
    setPrevStock(product.stock);
    setQuantity((q) => (product.stock <= 0 ? 1 : Math.min(Math.max(1, q), product.stock)));
  }

  useEffect(() => {
    if (!justAdded) return;
    const timer = window.setTimeout(() => setJustAdded(false), 1600);
    return () => window.clearTimeout(timer);
  }, [justAdded]);

  function handleAdd(event: React.MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (product.stock <= 0) return;
    if (!signedIn) {
      window.location.href = loginHref;
      return;
    }
    const qty = Math.min(Math.max(1, quantity), product.stock);
    const result = add(product.id, qty, product.stock);
    if (!result.ok) {
      if (result.reason === "auth") window.location.href = loginHref;
      return;
    }
    setJustAdded(true);
    setQuantity(1);
  }

  return (
    <article className="product-card">
      <Link className="product-card-image" href={`/products/${product.slug}`}>
        {image?.src ? (
          <Image
            src={image.src}
            alt={image.alt}
            fill
            sizes="(max-width: 640px) 80vw, (max-width: 1100px) 40vw, 25vw"
          />
        ) : (
          <div className="image-placeholder">Image coming soon</div>
        )}
        {product.featured ? <span className="product-badge">Featured</span> : null}
      </Link>
      <div className="product-card-body">
        <div className="eyebrow-row">
          <span>{product.category}</span>
          <span className={lowStock ? "stock-label low" : "stock-label"}>
            <PackageCheck size={14} aria-hidden="true" />
            {product.stock > 0
              ? lowStock
                ? `Only ${product.stock} left`
                : "In stock"
              : "Out of stock"}
          </span>
        </div>
        <h3>
          <Link href={`/products/${product.slug}`}>{product.name}</Link>
        </h3>
        <p>{product.shortDescription}</p>
        <div className="product-price-row">
          <div className="price-stack">
            {product.compareAtPrice != null ? (
              <>
                <span className="price-compare">{usd.format(product.compareAtPrice)}</span>
                <strong className="price-sale">{usd.format(product.price)}</strong>
                <span className="sale-badge">Sale</span>
              </>
            ) : (
              <strong>{usd.format(product.price)}</strong>
            )}
          </div>
          <Link className="product-card-details" href={`/products/${product.slug}`}>
            Details
          </Link>
        </div>

        {product.stock <= 0 ? (
          <button className="button product-card-add" type="button" disabled>
            Out of stock
          </button>
        ) : ready && !signedIn ? (
          <Link
            className="button product-card-add primary"
            href={loginHref}
            onClick={(e) => e.stopPropagation()}
          >
            <LogIn size={16} aria-hidden="true" /> Sign in to add
          </Link>
        ) : (
          <div className="product-card-cart-row">
            <div
              className="quantity-control product-card-qty"
              role="group"
              aria-label={`Quantity for ${product.name}`}
            >
              <button
                type="button"
                aria-label="Decrease quantity"
                disabled={quantity <= 1}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setQuantity((q) => Math.max(1, q - 1));
                }}
              >
                <Minus size={15} />
              </button>
              <span aria-live="polite">{quantity}</span>
              <button
                type="button"
                aria-label="Increase quantity"
                disabled={quantity >= product.stock}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setQuantity((q) => Math.min(product.stock, q + 1));
                }}
              >
                <Plus size={15} />
              </button>
            </div>
            <button
              className={`button product-card-add ${justAdded ? "is-added" : "primary"}`}
              type="button"
              onClick={handleAdd}
              disabled={!ready}
              aria-label={
                justAdded
                  ? `${product.name} added to cart`
                  : `Add ${quantity} ${product.name} to cart`
              }
            >
              {justAdded ? (
                <>
                  <Check size={16} aria-hidden="true" /> Added
                </>
              ) : (
                <>
                  <ShoppingBag size={16} aria-hidden="true" /> Add
                  {quantity > 1 ? ` (${quantity})` : ""}
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </article>
  );
}
