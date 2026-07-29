"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Check, Minus, Plus } from "lucide-react";
import { useCart } from "@/lib/cart";

// Bộ chọn số lượng + nút Add to cart. Giỏ chỉ lưu theo tài khoản — bắt buộc đăng nhập.
export function AddToCart({ productId, stock }: { productId: string; stock: number }) {
  const pathname = usePathname();
  const { add, signedIn, ready } = useCart();
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
  const loginHref = `/login?next=${encodeURIComponent(pathname || `/products`)}`;

  if (ready && !signedIn) {
    return (
      <>
        <div className="quantity-label" id={`quantity-label-${productId}`}>
          Quantity
        </div>
        <div className="purchase-row">
          <div className="quantity-control" role="group" aria-labelledby={`quantity-label-${productId}`}>
            <button type="button" aria-label="Decrease quantity" disabled>
              <Minus size={16} />
            </button>
            <span aria-live="polite">1</span>
            <button type="button" aria-label="Increase quantity" disabled>
              <Plus size={16} />
            </button>
          </div>
          <Link className="button primary add-to-cart" href={loginHref}>
            Sign in to add
          </Link>
        </div>
        <p className="payment-note">Your cart is saved to your account — sign in to shop.</p>
      </>
    );
  }

  function handleAdd() {
    const result = add(productId, quantity, stock);
    if (!result.ok) {
      if (result.reason === "auth") {
        window.location.href = loginHref;
      }
      return;
    }
    setJustAdded(true);
  }

  return (
    <>
      <div className="quantity-label" id={`quantity-label-${productId}`}>
        Quantity
      </div>
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
        <button
          className="button primary add-to-cart"
          type="button"
          onClick={handleAdd}
          disabled={!ready}
        >
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
          <Link className="text-link" href="/cart">
            Review your cart
          </Link>{" "}
          — saved to your account on every device.
        </p>
      ) : (
        <p className="payment-note">Cart is saved to your account, not this browser.</p>
      )}
    </>
  );
}
