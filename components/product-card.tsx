"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Check, PackageCheck, ShoppingBag } from "lucide-react";
import { useCart } from "@/lib/cart";
import type { Product } from "@/lib/sample-data";
import { usd } from "@/lib/format";

export function ProductCard({ product }: { product: Product }) {
  const image = product.media.find((item) => item.type === "image" && item.src);
  const lowStock = product.stock > 0 && product.stock <= 10;
  const { add } = useCart();
  const [justAdded, setJustAdded] = useState(false);

  useEffect(() => {
    if (!justAdded) return;
    const timer = window.setTimeout(() => setJustAdded(false), 1600);
    return () => window.clearTimeout(timer);
  }, [justAdded]);

  function handleAdd(event: React.MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (product.stock <= 0) return;
    add(product.id, 1, product.stock);
    setJustAdded(true);
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
        <button
          className={`button product-card-add ${justAdded ? "is-added" : "primary"}`}
          type="button"
          disabled={product.stock <= 0}
          onClick={handleAdd}
          aria-label={
            product.stock <= 0
              ? `${product.name} is out of stock`
              : justAdded
                ? `${product.name} added to cart`
                : `Add ${product.name} to cart`
          }
        >
          {product.stock <= 0 ? (
            "Out of stock"
          ) : justAdded ? (
            <>
              <Check size={16} aria-hidden="true" /> Added
            </>
          ) : (
            <>
              <ShoppingBag size={16} aria-hidden="true" /> Add to cart
            </>
          )}
        </button>
      </div>
    </article>
  );
}
