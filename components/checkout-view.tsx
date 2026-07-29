"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CheckCircle2, ShoppingBag, Store, Truck } from "lucide-react";
import { loadCheckoutBootstrap, placeTestOrder } from "@/app/checkout/actions";
import { ShippingAddressPicker } from "@/components/shipping-address-picker";
import { SpecialRequestPicker } from "@/components/special-request-picker";
import type { CustomerAddress } from "@/lib/data/address-types";
import { useCart } from "@/lib/cart";
import type { SpecialRequest } from "@/lib/special-request-types";
import {
  setFulfillmentMethod,
  useFulfillmentMethod,
  useHydrated,
  type FulfillmentMethod
} from "@/lib/fulfillment-preference";
import type { Product } from "@/lib/sample-data";
import { usd } from "@/lib/format";
import {
  SITE_OVERLOADED_MESSAGE,
  toUserFacingError
} from "@/lib/user-facing-error";

const SHIPPING_FLAT_RATE = 12.5;
const PLACE_ORDER_TIMEOUT_MS = 25_000;
const SESSION_RETRY_DELAY_MS = 700;

export function CheckoutView({
  pickupLocationName = "Vinameals store pickup"
}: {
  pickupLocationName?: string;
}) {
  const { items, ready, clear, setNote, signedIn: cartSignedIn } = useCart();
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const method = useFulfillmentMethod();
  const hydrated = useHydrated();

  const [bootLoading, setBootLoading] = useState(true);
  const [catalog, setCatalog] = useState<Product[]>([]);
  const [shippingAddresses, setShippingAddresses] = useState<CustomerAddress[]>([]);
  const [savedRequests, setSavedRequests] = useState<SpecialRequest[]>([]);
  const [customerName, setCustomerName] = useState("Customer");
  const [shippingAddressId, setShippingAddressId] = useState<string | null>(null);

  const [done, setDone] = useState<{
    orderNumber: string;
    invoiceNumber: string | null;
    total: number;
    fulfillmentMethod: FulfillmentMethod;
  } | null>(null);

  // Đọc trạng thái đăng nhập mới nhất bên trong effect chạy-một-lần.
  const cartSignedInRef = useRef(cartSignedIn);
  useEffect(() => {
    cartSignedInRef.current = cartSignedIn;
  }, [cartSignedIn]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setBootLoading(true);
      try {
        let boot = await loadCheckoutBootstrap();
        if (cancelled) return;
        // Server bảo "chưa đăng nhập" NHƯNG store giỏ (userId do header SSR
        // truyền xuống) bảo ngược lại → thử lại 1 lần trước khi đá user đang
        // đăng nhập ra /login. Guest thật không tốn lượt gọi nào.
        if (!boot.ok && !boot.signedIn && cartSignedInRef.current) {
          await new Promise((resolve) => setTimeout(resolve, SESSION_RETRY_DELAY_MS));
          if (cancelled) return;
          boot = await loadCheckoutBootstrap();
          if (cancelled) return;
        }
        if (!boot.ok) {
          if (!boot.signedIn) {
            window.location.href =
              "/login?next=/checkout&message=" +
              encodeURIComponent("Please sign in to place an order.");
            return;
          }
          setError(boot.error);
          setBootLoading(false);
          return;
        }
        setCatalog(boot.catalog);
        setShippingAddresses(boot.shippingAddresses);
        setSavedRequests(boot.specialRequests);
        setCustomerName(boot.customerName);
        setShippingAddressId(
          boot.shippingAddresses.find((a) => a.isDefault)?.id ??
            boot.shippingAddresses[0]?.id ??
            null
        );
      } catch (err) {
        if (!cancelled) setError(toUserFacingError(err, SITE_OVERLOADED_MESSAGE));
      } finally {
        if (!cancelled) setBootLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function chooseMethod(next: FulfillmentMethod) {
    setFulfillmentMethod(next);
  }

  const byId = new Map(catalog.map((product) => [product.id, product]));

  if (!ready || !hydrated || bootLoading) {
    return (
      <div className="page-shell shell narrow-page" aria-busy="true">
        <p className="field-hint" style={{ padding: "2rem 0" }}>
          Loading checkout…
        </p>
      </div>
    );
  }

  const lines = items
    .map((item) => ({ ...item, product: byId.get(item.productId) }))
    .filter((line): line is typeof line & { product: Product } => Boolean(line.product));
  const subtotal = lines.reduce((sum, line) => sum + line.product.price * line.quantity, 0);

  if (done) {
    return (
      <div className="page-shell shell narrow-page">
        <div className="empty-state large">
          <CheckCircle2 size={40} aria-hidden="true" />
          <h1>Order placed</h1>
          <p>
            Order <strong>{done.orderNumber}</strong>
            {done.invoiceNumber ? (
              <>
                {" "}
                · invoice <strong>{done.invoiceNumber}</strong>
              </>
            ) : null}{" "}
            — total {usd.format(done.total)}.{" "}
            {done.fulfillmentMethod === "pickup" ? (
              <>
                Pickup at <strong>{pickupLocationName}</strong>.
              </>
            ) : (
              <>
                <strong>Shipping</strong> — staff will send tracking when the order ships.
              </>
            )}{" "}
            Marked as <strong>paid in full</strong> (test checkout).
          </p>
          <div className="checkout-actions-row">
            <Link className="button primary" href="/products">
              Continue shopping
            </Link>
            <Link className="button secondary" href="/account">
              View orders
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className="page-shell shell narrow-page">
        <div className="empty-state large">
          <ShoppingBag size={36} aria-hidden="true" />
          <h1>Your cart is empty</h1>
          <p>Add products to your cart before checking out.</p>
          <Link className="button primary" href="/products">
            Browse products
          </Link>
        </div>
      </div>
    );
  }

  if (!lines.length && catalog.length === 0) {
    return (
      <div className="page-shell shell narrow-page">
        <div className="empty-state large overload-state">
          <div className="overload-badge" aria-hidden="true">
            !
          </div>
          <h1>Website overloaded</h1>
          <p>{error || SITE_OVERLOADED_MESSAGE}</p>
          <div className="checkout-actions-row">
            <Link className="button primary" href="/cart">
              Back to cart
            </Link>
            <Link className="button secondary" href="/checkout">
              Try again
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
          <h1>Cart items unavailable</h1>
          <p>Some products in your cart are no longer available. Update your cart and try again.</p>
          <Link className="button primary" href="/cart">
            Back to cart
          </Link>
        </div>
      </div>
    );
  }

  async function submit() {
    if (placing) return;
    setPlacing(true);
    setError(null);
    try {
      if (method === "ship" && !shippingAddressId) {
        setError("Select a shipping address for delivery orders.");
        return;
      }

      const result = await Promise.race([
        placeTestOrder(
          lines.map((line) => ({
            productId: line.product.id,
            quantity: line.quantity,
            note: line.note
          })),
          {
            fulfillmentMethod: method,
            shippingAddressId: method === "ship" ? shippingAddressId : null
          }
        ),
        new Promise<never>((_, reject) => {
          window.setTimeout(() => reject(new Error(SITE_OVERLOADED_MESSAGE)), PLACE_ORDER_TIMEOUT_MS);
        })
      ]);

      if (result.ok) {
        clear();
        setDone({
          orderNumber: result.orderNumber,
          invoiceNumber: result.invoiceNumber,
          total: result.total,
          fulfillmentMethod: result.fulfillmentMethod
        });
      } else {
        setError(toUserFacingError(result.error, "Could not place the order. Please try again."));
      }
    } catch (err) {
      setError(toUserFacingError(err, "Could not place the order. Please try again."));
    } finally {
      setPlacing(false);
    }
  }

  return (
    <div className="page-shell shell narrow-page">
      <header className="page-heading">
        <span className="kicker">Checkout</span>
        <h1>Confirm your order</h1>
        <p>
          Choose <strong>pickup</strong> or <strong>shipping</strong>. Add a special request per
          item if needed.
        </p>
      </header>

      <div className="checkout-fulfillment-block">
        <p className="field-hint" style={{ marginBottom: 10 }}>
          Customer: <strong>{customerName}</strong>
        </p>
        <div className="fulfillment-choice">
          <label>
            <input
              type="radio"
              name="checkout-fulfillment"
              value="pickup"
              checked={method === "pickup"}
              onChange={() => chooseMethod("pickup")}
            />
            <span>
              <strong>
                <Store size={15} aria-hidden="true" /> Store pickup
              </strong>
              <small>Pick up at {pickupLocationName}. No shipping fee.</small>
            </span>
          </label>
          <label>
            <input
              type="radio"
              name="checkout-fulfillment"
              value="ship"
              checked={method === "ship"}
              onChange={() => chooseMethod("ship")}
            />
            <span>
              <strong>
                <Truck size={15} aria-hidden="true" /> Ship to address
              </strong>
              <small>Delivered to you — staff adds tracking when shipped.</small>
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
            Pick up at <strong>{pickupLocationName}</strong> — bring your order number and photo ID.
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
              <SpecialRequestPicker
                productId={product.id}
                value={note}
                suggestions={savedRequests}
                onChange={(id, next) => setNote(id, next)}
                onSuggestionsChange={setSavedRequests}
                label="Special request"
              />
            </div>
            <strong className="cart-line-total">{usd.format(product.price * quantity)}</strong>
          </li>
        ))}
      </ul>

      <div className="checkout-summary">
        <div className="checkout-summary-row">
          <span>Subtotal</span>
          <strong>{usd.format(subtotal)}</strong>
        </div>
        <div className="checkout-summary-row muted">
          <span>Fulfillment</span>
          <span>{method === "pickup" ? "Pickup" : "Shipping"}</span>
        </div>
        {method === "ship" ? (
          <div className="checkout-summary-row muted">
            <span>Shipping</span>
            <span>{usd.format(SHIPPING_FLAT_RATE)}</span>
          </div>
        ) : null}
        <div className="checkout-summary-row total">
          <span>Total</span>
          <strong>{usd.format(subtotal + (method === "ship" ? SHIPPING_FLAT_RATE : 0))}</strong>
        </div>
      </div>

      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}

      <button
        className="button primary block"
        type="button"
        disabled={placing}
        onClick={() => void submit()}
      >
        {placing
          ? "Placing order…"
          : method === "pickup"
            ? "Place order — pickup"
            : "Place order — ship"}
      </button>
      <Link className="button ghost block" href="/cart">
        Back to cart
      </Link>
    </div>
  );
}
