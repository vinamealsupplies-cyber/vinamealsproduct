"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Minus, Plus, ShoppingBag, Trash2, X } from "lucide-react";
import { loadCartBootstrap } from "@/app/cart/bootstrap";
import { FulfillmentPicker } from "@/components/fulfillment-picker";
import { SetupNotice } from "@/components/setup-notice";
import { SpecialRequestPicker } from "@/components/special-request-picker";
import type { CustomerAddress } from "@/lib/data/address-types";
import { useCart } from "@/lib/cart";
import type { Product } from "@/lib/sample-data";
import { usd } from "@/lib/format";
import type { SpecialRequest } from "@/lib/special-request-types";
import type { BusinessAccount } from "@/lib/business-order";
import { computeBusinessDiscount } from "@/lib/business-order";
import {
  SITE_OVERLOADED_MESSAGE,
  toUserFacingError
} from "@/lib/user-facing-error";

const SESSION_RETRY_DELAY_MS = 700;

// Cart UI. All DB work runs after mount via loadCartBootstrap (not in page SSR).
export function CartView() {
  const { items, setQuantity, setNote, remove, clear, ready, signedIn: cartSignedIn } =
    useCart();

  const [bootLoading, setBootLoading] = useState(true);
  const [bootError, setBootError] = useState<string | null>(null);
  // null = chưa biết (bootstrap lỗi / chưa trả lời). KHÔNG mặc định false: coi
  // lỗi mạng là "chưa đăng nhập" sẽ đá văng user đang đăng nhập ra màn Sign in.
  const [sessionSignedIn, setSessionSignedIn] = useState<boolean | null>(null);
  const [catalog, setCatalog] = useState<Product[]>([]);
  const [shippingAddresses, setShippingAddresses] = useState<CustomerAddress[]>([]);
  const [savedRequests, setSavedRequests] = useState<SpecialRequest[]>([]);
  const [businessAccount, setBusinessAccount] = useState<BusinessAccount | null>(null);

  // Đọc trạng thái đăng nhập mới nhất bên trong effect chạy-một-lần.
  const cartSignedInRef = useRef(cartSignedIn);
  useEffect(() => {
    cartSignedInRef.current = cartSignedIn;
  }, [cartSignedIn]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setBootLoading(true);
      setBootError(null);
      try {
        let boot = await loadCartBootstrap();
        if (cancelled) return;
        // Server bảo "chưa đăng nhập" NHƯNG store (userId do header SSR truyền
        // xuống) bảo đang đăng nhập → mâu thuẫn nhất thời, thử lại 1 lần. Guest
        // thật thì store cũng nói guest nên không tốn lượt gọi nào.
        if (!boot.ok && !boot.signedIn && cartSignedInRef.current) {
          await new Promise((resolve) => setTimeout(resolve, SESSION_RETRY_DELAY_MS));
          if (cancelled) return;
          boot = await loadCartBootstrap();
          if (cancelled) return;
        }
        if (!boot.ok) {
          if (!boot.signedIn) {
            setSessionSignedIn(false);
            setBootLoading(false);
            return;
          }
          setSessionSignedIn(true);
          setBootError(boot.error);
          setBootLoading(false);
          return;
        }
        setSessionSignedIn(true);
        setCatalog(boot.catalog);
        setShippingAddresses(boot.shippingAddresses);
        setSavedRequests(boot.specialRequests);
        setBusinessAccount(boot.businessAccount);
      } catch (err) {
        if (!cancelled) {
          // Giữ sessionSignedIn = null: lỗi gọi action KHÔNG phải bằng chứng
          // user chưa đăng nhập (header đã SSR ra viewer rồi).
          setBootError(toUserFacingError(err, SITE_OVERLOADED_MESSAGE));
        }
      } finally {
        if (!cancelled) setBootLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!ready || bootLoading) {
    return (
      <div className="page-shell shell narrow-page" aria-busy="true">
        <p className="field-hint" style={{ padding: "2rem 0" }}>
          Loading cart…
        </p>
      </div>
    );
  }

  // Guest CHỈ khi cả hai nguồn cùng nói vậy: store giỏ (userId do header SSR
  // truyền xuống) và bootstrap. Hai server action của /cart chạy song song, nếu
  // gặp lúc refresh token xoay vòng thì cái thua trả signedIn=false — một mình
  // nó không đủ để kết luận user đã đăng xuất.
  if (!cartSignedIn && sessionSignedIn !== true) {
    return (
      <div className="page-shell shell narrow-page">
        <div className="empty-state large">
          <ShoppingBag size={36} />
          <h1>Sign in to view your cart</h1>
          <p>
            Your cart is saved to your account — not this browser — so you can shop on any device.
          </p>
          <Link className="button primary" href="/login?next=/cart">
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  // Đang đăng nhập nhưng bootstrap chưa lấy được dữ liệu → màn thử lại.
  if (sessionSignedIn !== true && catalog.length === 0) {
    return (
      <div className="page-shell shell narrow-page">
        <div className="empty-state large overload-state">
          <div className="overload-badge" aria-hidden="true">
            !
          </div>
          <h1>Could not load your cart</h1>
          <p>{bootError ?? SITE_OVERLOADED_MESSAGE}</p>
          <div className="checkout-actions-row">
            <Link className="button primary" href="/cart">
              Try again
            </Link>
            <Link className="button secondary" href="/products">
              Browse products
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (bootError && catalog.length === 0) {
    return (
      <div className="page-shell shell narrow-page">
        <div className="empty-state large overload-state">
          <div className="overload-badge" aria-hidden="true">
            !
          </div>
          <h1>Website overloaded</h1>
          <p>{bootError}</p>
          <div className="checkout-actions-row">
            <Link className="button primary" href="/cart">
              Try again
            </Link>
            <Link className="button secondary" href="/products">
              Browse products
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const byId = new Map(catalog.map((product) => [product.id, product]));
  const lines = items
    .map((item) => ({ ...item, product: byId.get(item.productId) }))
    .filter((line): line is typeof line & { product: Product } => Boolean(line.product));

  if (!lines.length) {
    return (
      <div className="page-shell shell narrow-page">
        <div className="empty-state large">
          <ShoppingBag size={36} />
          <h1>Your cart is empty</h1>
          <p>
            Browse the catalog to add items. Your cart stays with your account on every device.
          </p>
          <Link className="button primary" href="/products">
            Browse products
          </Link>
        </div>
      </div>
    );
  }

  const cartQuantity = lines.reduce((sum, line) => sum + line.quantity, 0);
  const retailSubtotal = lines.reduce((sum, line) => sum + line.product.price * line.quantity, 0);
  const businessDiscount = businessAccount?.isBusiness
    ? computeBusinessDiscount(retailSubtotal, businessAccount.discountPercent)
    : 0;

  return (
    <div className="page-shell shell narrow-page">
      <header className="page-heading split-heading">
        <div>
          <span className="kicker">Cart</span>
          <h1>Your cart</h1>
          <p>
            {cartQuantity} item{cartQuantity === 1 ? "" : "s"} — quantities are capped at available
            stock.
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
              <strong className="cart-line-total">
                {usd.format(product.price * quantity)}
              </strong>
              <button
                className="cart-remove"
                type="button"
                aria-label={`Remove ${product.name} from cart`}
                onClick={() => remove(product.id)}
              >
                <X size={17} />
              </button>
              <div className="cart-item-note-row">
                <SpecialRequestPicker
                  productId={product.id}
                  value={note}
                  suggestions={savedRequests}
                  onChange={(id, next) => setNote(id, next)}
                  onSuggestionsChange={setSavedRequests}
                />
              </div>
            </li>
          );
        })}
      </ul>

      <div className="checkout-cta">
        <Link className="button primary block" href="/checkout">
          Proceed to checkout
        </Link>
      </div>

      <SetupNotice title="Test checkout (marked paid)">
        On checkout, use <strong>Place test order — mark as paid</strong> to create a sales order,
        invoice, and paid receipt for testing Orders / Invoices / Payments / Reports. Real Stripe
        card payments come later.
        {businessAccount?.isBusiness
          ? ` Business accounts can pay by card or offline (check / Zelle / bank transfer).${
              businessAccount.discountPercent
                ? ` Discount: ${businessAccount.discountPercent}%.`
                : ""
            }`
          : ""}
      </SetupNotice>

      <FulfillmentPicker
        retailSubtotal={retailSubtotal}
        businessDiscount={businessDiscount}
        isBusiness={Boolean(businessAccount?.isBusiness)}
        businessDiscountPercent={businessAccount?.discountPercent ?? null}
        shippingAddresses={shippingAddresses}
        onShippingAddressesChange={setShippingAddresses}
        signedIn={sessionSignedIn === true || cartSignedIn}
      />
    </div>
  );
}
