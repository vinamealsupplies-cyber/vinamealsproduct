"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, MessageSquareText, ShoppingBag, Store, Truck } from "lucide-react";
import { placeTestOrder } from "@/app/checkout/actions";
import { ShippingAddressPicker } from "@/components/shipping-address-picker";
import type { CustomerAddress } from "@/lib/data/address-types";
import { useCart } from "@/lib/cart";
import type { Product } from "@/lib/sample-data";
import { usd } from "@/lib/format";

type FulfillmentMethod = "pickup" | "ship";

// Bước xác nhận đơn: chọn pickup hoặc ship + địa chỉ, ghi chú từng món.
export function CheckoutView({
  catalog,
  customerName,
  pickupLocationName,
  shippingAddresses = []
}: {
  catalog: Product[];
  customerName: string;
  pickupLocationName: string;
  shippingAddresses?: CustomerAddress[];
}) {
  const { items, ready, clear, setNote } = useCart();
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [method, setMethod] = useState<FulfillmentMethod>("pickup");
  const [shippingAddressId, setShippingAddressId] = useState<string | null>(
    shippingAddresses.find((a) => a.isDefault)?.id ?? shippingAddresses[0]?.id ?? null
  );
  const [done, setDone] = useState<{
    orderNumber: string;
    total: number;
    fulfillmentMethod: FulfillmentMethod;
  } | null>(null);

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
            Mã đơn <strong>{done.orderNumber}</strong> — tổng {usd.format(done.total)}.{" "}
            {done.fulfillmentMethod === "pickup" ? (
              <>
                Nhận tại <strong>{pickupLocationName}</strong>.
              </>
            ) : (
              <>Đơn <strong>ship</strong> — nhân viên sẽ gửi hàng và cập nhật tracking.</>
            )}{" "}
            Chưa thu tiền (đơn đặt thử).
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
    if (method === "ship" && !shippingAddressId) {
      setPlacing(false);
      setError("Chọn địa chỉ giao hàng cho đơn ship.");
      return;
    }
    const result = await placeTestOrder(
      lines.map((line) => ({
        productId: line.product.id,
        quantity: line.quantity,
        note: line.note
      })),
      {
        fulfillmentMethod: method,
        shippingAddressId: method === "ship" ? shippingAddressId : null
      }
    );
    setPlacing(false);
    if (result.ok) {
      clear();
      setDone({
        orderNumber: result.orderNumber,
        total: result.total,
        fulfillmentMethod: result.fulfillmentMethod
      });
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
          Chọn <strong>pickup</strong> hoặc <strong>ship</strong>. Thêm ghi chú từng món nếu có yêu
          cầu đặc biệt.
        </p>
      </header>

      <div className="checkout-fulfillment-block">
        <p className="field-hint" style={{ marginBottom: 10 }}>
          Khách: <strong>{customerName}</strong>
        </p>
        <div className="fulfillment-choice">
          <label>
            <input
              type="radio"
              name="checkout-fulfillment"
              value="pickup"
              checked={method === "pickup"}
              onChange={() => setMethod("pickup")}
            />
            <span>
              <strong>
                <Store size={15} aria-hidden="true" /> Store pickup
              </strong>
              <small>Nhận tại {pickupLocationName}. Không phí ship.</small>
            </span>
          </label>
          <label>
            <input
              type="radio"
              name="checkout-fulfillment"
              value="ship"
              checked={method === "ship"}
              onChange={() => setMethod("ship")}
            />
            <span>
              <strong>
                <Truck size={15} aria-hidden="true" /> Ship to address
              </strong>
              <small>Giao tận nơi — nhân viên cập nhật tracking khi đã ship.</small>
            </span>
          </label>
        </div>
        {method === "ship" ? (
          <div style={{ marginTop: 14 }}>
            <ShippingAddressPicker
              addresses={shippingAddresses}
              signedIn
              selectedId={shippingAddressId}
              onSelect={setShippingAddressId}
            />
          </div>
        ) : (
          <p className="field-hint" style={{ marginTop: 12 }}>
            Đến lấy tại <strong>{pickupLocationName}</strong> — mang mã đơn và giấy tờ tùy thân.
          </p>
        )}
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
          <span>Nhận hàng</span>
          <span>{method === "pickup" ? "Pickup" : "Ship"}</span>
        </div>
        <div className="checkout-summary-row total">
          <span>Tổng cộng</span>
          <strong>{usd.format(subtotal + (method === "ship" ? 12.5 : 0))}</strong>
        </div>
      </div>

      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}

      <button className="button primary block" type="button" disabled={placing} onClick={submit}>
        {placing
          ? "Đang tạo đơn…"
          : method === "pickup"
            ? "Đặt hàng — pickup"
            : "Đặt hàng — ship"}
      </button>
      <Link className="button ghost block" href="/cart">
        Quay lại giỏ hàng
      </Link>
    </div>
  );
}
