"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, Minus, Plus } from "lucide-react";
import { useCart } from "@/lib/cart";

// Bộ chọn số lượng + nút Add to cart hoạt động thật (trước đây chỉ là UI
// tĩnh không có handler). Số lượng kẹp theo tồn kho.
export function AddToCart({ productId, stock }: { productId: string; stock: number }) {
  const { add } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [justAdded, setJustAdded] = useState(false);

  useEffect(() => {
    if (!justAdded) return;
    const timer = window.setTimeout(() => setJustAdded(false), 2000);
    return () => window.clearTimeout(timer);
  }, [justAdded]);

  if (stock <= 0) {
    return (
      <div className="purchase-row">
        <button className="button secondary add-to-cart" type="button" disabled>
          Out of stock
        </button>
      </div>
    );
  }

  const max = stock;

  function handleAdd() {
    add(productId, quantity, stock);
    setJustAdded(true);
  }

  return (
    <>
      <div className="quantity-label" id={`quantity-label-${productId}`}>Quantity</div>
      <div className="purchase-row">
        <div className="quantity-control" role="group" aria-labelledby={`quantity-label-${productId}`}>
          <button
            type="button"
            aria-label="Decrease quantity"
            disabled={quantity <= 1}
            onClick={() => setQuantity((current) => Math.max(1, current - 1))}
          >
            <Minus size={16} />
          </button>
          <span aria-live="polite">{quantity}</span>
          <button
            type="button"
            aria-label="Increase quantity"
            disabled={quantity >= max}
            onClick={() => setQuantity((current) => Math.min(max, current + 1))}
          >
            <Plus size={16} />
          </button>
        </div>
        <button className="button primary add-to-cart" type="button" onClick={handleAdd}>
          {justAdded ? (
            <>
              <Check size={17} aria-hidden="true" /> Added to cart
            </>
          ) : (
            "Add to cart"
          )}
        </button>
      </div>
      {justAdded ? (
        <p className="payment-note" role="status">
          <Link className="text-link" href="/cart">Review your cart</Link> — quantities and totals update there.
        </p>
      ) : (
        <p className="payment-note">
          Items are saved in your cart on this device. Secure checkout and payment open in a later phase.
        </p>
      )}
    </>
  );
}
