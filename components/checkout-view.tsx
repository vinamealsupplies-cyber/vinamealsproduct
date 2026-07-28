"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, MessageSquareText, ShoppingBag, Store } from "lucide-react";
import { placeTestOrder } from "@/app/checkout/actions";
import { useCart } from "@/lib/cart";
import type { Product } from "@/lib/sample-data";
import { usd } from "@/lib/format";

// Bước xác nhận đơn. Ghi chú từng món (từ giỏ) gửi kèm placeTestOrder.
export function CheckoutView({
  catalog,
  customerName,
  pickupLocationName
}: {
  catalog: Product[];
  customerName: string;
  pickupLocationName: string;
}) {
  const { items, ready, clear, setNote } = useCart();
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ orderNumber: string; total: number } | null>(null);

  const byId = new Map(catalog.map((product) => [product.id, product]));

  if (!ready) return <div className="page-shell shell narrow-page" aria-busy="true" />;

  const lines = items
    .map((item) => ({ ...item, product: byId.get(item.productId) }))
    .filter((line): line is typeof line & { product: Product } => Boolean(line.product));
  const subtotal = lines.reduce((sum, line) => sum + line.product.price * line.quantity, 0);

  if (done) {
    return (
      <div className="page-shell shell narrow-page">
        <div className="empty-state large">
          <CheckCircle2 size={40} aria-hidden="true" />
          <h1>Đặt hàng thành công</h1>
          <p>
            Mã đơn <strong>{done.orderNumber}</strong> — tổng {usd.format(done.total)}. Nhận tại{" "}
            {pickupLocationName}. Chưa thu tiền (đơn đặt thử).
          </p>
          <div className="checkout-actions-row">
            <Link className="button primary" href="/products">
              Tiếp tục mua
            </Link>
            <Link className="button secondary" href="/account">
              Xem đơn hàng
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!lines.length) {
    return (
      <div className="page-shell shell narrow-page">
        <div className="empty-state large">
          <ShoppingBag size={36} aria-hidden="true" />
          <h1>Giỏ hàng trống</h1>
          <p>Thêm sản phẩm vào giỏ trước khi đặt hàng.</p>
          <Link className="button primary" href="/products">
            Xem sản phẩm
          </Link>
        </div>
      </div>
    );
  }

  async function submit() {
    setPlacing(true);
    setError(null);
    const result = await placeTestOrder(
      lines.map((line) => ({
        productId: line.product.id,
        quantity: line.quantity,
        note: line.note
      }))
    );
    setPlacing(false);
    if (result.ok) {
      clear();
      setDone({ orderNumber: result.orderNumber, total: result.total });
    } else {
      setError(result.error);
    }
  }

  return (
    <div className="page-shell shell narrow-page">
      <header className="page-heading">
        <span className="kicker">Checkout</span>
        <h1>Xác nhận đơn hàng</h1>
        <p>
          Đặt hàng thử — không cần thanh toán. Thêm ghi chú từng món nếu có yêu cầu đặc biệt (nhân
          viên sẽ thấy khi chuẩn bị giao).
        </p>
      </header>

      <div className="checkout-pickup">
        <Store size={18} aria-hidden="true" />
        <span>
          Nhận hàng tại <strong>{pickupLocationName}</strong> · Khách: {customerName}
        </span>
      </div>

      <ul className="cart-items checkout-lines">
        {lines.map(({ product, quantity, note }) => (
          <li className="checkout-line checkout-line-with-note" key={product.id}>
            <div className="checkout-line-info">
              <span className="checkout-line-name">{product.name}</span>
              <span className="cart-unit-price">
                {usd.format(product.price)} × {quantity}
              </span>
              <label className="cart-line-note">
                <span>
                  <MessageSquareText size={13} aria-hidden="true" /> Special request
                </span>
                <textarea
                  rows={2}
                  maxLength={300}
                  placeholder="e.g. ripe fruit, pack separately…"
                  defaultValue={note ?? ""}
                  onBlur={(event) => setNote(product.id, event.target.value)}
                />
              </label>
            </div>
            <strong className="cart-line-total">{usd.format(product.price * quantity)}</strong>
          </li>
        ))}
      </ul>

      <div className="checkout-summary">
        <div className="checkout-summary-row">
          <span>Tạm tính</span>
          <strong>{usd.format(subtotal)}</strong>
        </div>
        <div className="checkout-summary-row muted">
          <span>Thuế / phí vận chuyển</span>
          <span>—</span>
        </div>
        <div className="checkout-summary-row total">
          <span>Tổng cộng</span>
          <strong>{usd.format(subtotal)}</strong>
        </div>
      </div>

      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}

      <button className="button primary block" type="button" disabled={placing} onClick={submit}>
        {placing ? "Đang tạo đơn…" : "Đặt hàng thử (không thanh toán)"}
      </button>
      <Link className="button ghost block" href="/cart">
        Quay lại giỏ hàng
      </Link>
    </div>
  );
}
