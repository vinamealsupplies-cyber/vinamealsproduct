"use client";

import Image from "next/image";
import Link from "next/link";
import { Minus, Plus, ShoppingBag, Trash2, X } from "lucide-react";
import { FulfillmentPicker } from "@/components/fulfillment-picker";
import { SetupNotice } from "@/components/setup-notice";
import type { CustomerAddress } from "@/lib/data/address-types";
import { useCart } from "@/lib/cart";
import type { Product } from "@/lib/sample-data";
import { usd } from "@/lib/format";

// Trang giỏ hàng thật: liệt kê món đã thêm, sửa số lượng, xoá, và nối
// subtotal thật (retail + wholesale) vào FulfillmentPicker. Catalog lấy từ DB
// và truyền từ server (app/cart/page.tsx) để giá/tồn kho luôn khớp DB.
export function CartView({
  catalog,
  shippingAddresses = [],
  signedIn = false
}: {
  catalog: Product[];
  shippingAddresses?: CustomerAddress[];
  signedIn?: boolean;
}) {
  const { items, setQuantity, setNote, remove, clear, ready } = useCart();
  const byId = new Map(catalog.map((product) => [product.id, product]));

  // Chờ đọc xong localStorage để không flash "giỏ trống" rồi mới hiện hàng.
  if (!ready) return <div className="page-shell shell narrow-page" aria-busy="true" />;

  const lines = items
    .map((item) => ({ ...item, product: byId.get(item.productId) }))
    .filter((line): line is typeof line & { product: Product } => Boolean(line.product));

  if (!lines.length) {
    return (
      <div className="page-shell shell narrow-page">
        <div className="empty-state large">
          <ShoppingBag size={36} />
          <h1>Your cart is empty</h1>
          <p>Browse the catalog to add items. Delivery options and tax are calculated at the cart.</p>
          <Link className="button primary" href="/products">
            Browse products
          </Link>
        </div>
      </div>
    );
  }

  const retailSubtotal = lines.reduce((sum, line) => sum + line.product.price * line.quantity, 0);
  // Giá sỉ không còn được gửi ra storefront (chỉ tài khoản wholesale đã duyệt
  // mới thấy, qua v_account_price_list). Khối "Wholesale pricing" của
  // FulfillmentPicker vì vậy tính trên cùng subtotal bán lẻ cho tới khi luồng
  // giá theo tài khoản được nối.
  const wholesaleSubtotal = retailSubtotal;
  const count = lines.reduce((sum, line) => sum + line.quantity, 0);

  return (
    <div className="page-shell shell narrow-page">
      <header className="page-heading split-heading">
        <div>
          <span className="kicker">Cart</span>
          <h1>Your cart</h1>
          <p>
            {count} item{count === 1 ? "" : "s"} — quantities are capped at available stock.
          </p>
        </div>
        <button className="button secondary compact" type="button" onClick={clear}>
          <Trash2 size={15} aria-hidden="true" /> Clear cart
        </button>
      </header>

      <ul className="cart-items">
        {lines.map(({ product, quantity, note }) => {
          const image = product.media.find((item) => item.type === "image" && item.src);
          return (
            <li className="cart-item cart-item-with-note" key={product.id}>
              <Link className="cart-item-image" href={`/products/${product.slug}`}>
                {image?.src ? (
                  <Image src={image.src} alt={image.alt} fill sizes="90px" />
                ) : (
                  <span className="image-placeholder">No image</span>
                )}
              </Link>
              <div className="cart-item-info">
                <Link href={`/products/${product.slug}`}>{product.name}</Link>
                <span className="cart-unit-price">
                  {product.compareAtPrice != null ? (
                    <>
                      <span className="price-compare">{usd.format(product.compareAtPrice)}</span>{" "}
                      <strong className="price-sale">{usd.format(product.price)}</strong> each
                    </>
                  ) : (
                    <>{usd.format(product.price)} each</>
                  )}
                </span>
                <label className="cart-line-note">
                  <span>Special request for this item</span>
                  <textarea
                    rows={2}
                    maxLength={300}
                    placeholder="e.g. ripe fruit, no ice, call on arrival…"
                    defaultValue={note ?? ""}
                    onBlur={(event) => setNote(product.id, event.target.value)}
                  />
                </label>
              </div>
              <div className="quantity-control" aria-label={`Quantity for ${product.name}`}>
                <button
                  type="button"
                  aria-label={`Decrease quantity of ${product.name}`}
                  onClick={() => setQuantity(product.id, quantity - 1, product.stock)}
                >
                  <Minus size={15} />
                </button>
                <span aria-live="polite">{quantity}</span>
                <button
                  type="button"
                  aria-label={`Increase quantity of ${product.name}`}
                  disabled={quantity >= product.stock}
                  onClick={() => setQuantity(product.id, quantity + 1, product.stock)}
                >
                  <Plus size={15} />
                </button>
              </div>
              <strong className="cart-line-total">{usd.format(product.price * quantity)}</strong>
              <button
                className="cart-remove"
                type="button"
                aria-label={`Remove ${product.name} from cart`}
                onClick={() => remove(product.id)}
              >
                <X size={17} />
              </button>
            </li>
          );
        })}
      </ul>

      <div className="checkout-cta">
        <Link className="button primary block" href="/checkout">
          Tiến hành đặt hàng (thử — không thanh toán)
        </Link>
        {!signedIn ? <p className="checkout-cta-note">Cần đăng nhập để đặt hàng.</p> : null}
      </div>

      <SetupNotice>
        Đang bật chế độ đặt hàng thử: bấm “Tiến hành đặt hàng” để tạo đơn nhận tại cửa hàng mà KHÔNG cần
        thanh toán. Thanh toán online (Stripe Tax + thẻ) sẽ được nối ở phase sau.
      </SetupNotice>

      <FulfillmentPicker
        retailSubtotal={retailSubtotal}
        wholesaleSubtotal={wholesaleSubtotal}
        shippingAddresses={shippingAddresses}
        signedIn={signedIn}
      />
    </div>
  );
}
