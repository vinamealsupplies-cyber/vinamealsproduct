"use client";

import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { useCart } from "@/lib/cart";

// Nút Cart trên header với badge đếm thật từ giỏ hàng (trước đây cứng số 0).
export function CartLink() {
  const { count, ready } = useCart();
  const shown = ready ? count : 0;

  return (
    <Link className="header-action" href="/cart" aria-label={`Cart with ${shown} item${shown === 1 ? "" : "s"}`}>
      <ShoppingBag size={19} aria-hidden="true" />
      <span>Cart</span>
      <span className="cart-count">{shown}</span>
    </Link>
  );
}
