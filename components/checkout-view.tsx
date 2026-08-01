"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Building2,
  CheckCircle2,
  CreditCard,
  Landmark,
  Phone,
  ShoppingBag,
  Store,
  Truck
} from "lucide-react";
import { loadCheckoutBootstrap, placeOrder } from "@/app/(storefront)/checkout/actions";
import { ShippingAddressPicker } from "@/components/shipping-address-picker";
import { SpecialRequestPicker } from "@/components/special-request-picker";
import type { CustomerAddress } from "@/lib/data/address-types";
import { OfflinePaymentDetails } from "@/components/offline-payment-details";
import {
  BUSINESS_PAYMENT_HINTS,
  BUSINESS_PAYMENT_METHODS,
  computeBusinessDiscount,
  isBusinessPaymentMethod,
  isOfflinePaymentMethod,
  PAYMENT_METHOD_LABELS,
  type BusinessPaymentMethod
} from "@/lib/business-order";
import { useCart } from "@/lib/cart";
import type { SpecialRequest } from "@/lib/special-request-types";
import {
  setFulfillmentMethod,
  useFulfillmentMethod,
  useHydrated,
  type FulfillmentMethod
} from "@/lib/fulfillment-preference";
import type { Product } from "@/lib/sample-data";
import {
  defaultStoreBusinessProfile,
  type StoreBusinessProfile
} from "@/lib/store-profile";
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
  const [accountPhone, setAccountPhone] = useState<string | null>(null);
  const [phoneInput, setPhoneInput] = useState("");
  const [shippingAddressId, setShippingAddressId] = useState<string | null>(null);
  const [isBusiness, setIsBusiness] = useState(false);
  const [businessDiscountPercent, setBusinessDiscountPercent] = useState<number | null>(null);
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<BusinessPaymentMethod>("card");
  const [paymentReference, setPaymentReference] = useState("");
  const [storeProfile, setStoreProfile] = useState<StoreBusinessProfile>(
    defaultStoreBusinessProfile()
  );

  const [done, setDone] = useState<{
    orderNumber: string;
    invoiceNumber: string | null;
    total: number;
    discountAmount: number;
    fulfillmentMethod: FulfillmentMethod;
    paymentMethod: BusinessPaymentMethod | null;
    paymentInstructions: string | null;
    awaitingPayment: boolean;
    isBusinessOrder: boolean;
  } | null>(null);

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
        setAccountPhone(boot.phone);
        setIsBusiness(boot.isBusiness);
        setBusinessDiscountPercent(boot.businessDiscountPercent);
        setCompanyName(boot.companyName);
        setStoreProfile(boot.storeProfile);
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

  // Account has no phone yet → ask for one at checkout and save it back.
  const needsPhone = !accountPhone;

  const lines = items
    .map((item) => ({ ...item, product: byId.get(item.productId) }))
    .filter((line): line is typeof line & { product: Product } => Boolean(line.product));
  const merchandiseSubtotal = lines.reduce(
    (sum, line) => sum + line.product.price * line.quantity,
    0
  );
  const discountAmount = isBusiness
    ? computeBusinessDiscount(merchandiseSubtotal, businessDiscountPercent)
    : 0;
  const shipping = method === "ship" ? SHIPPING_FLAT_RATE : 0;
  const total = Math.max(0, merchandiseSubtotal - discountAmount + shipping);

  if (done) {
    return (
      <div className="page-shell shell narrow-page">
        <div className="empty-state large">
          <CheckCircle2 size={40} aria-hidden="true" />
          <h1>
            {done.awaitingPayment
              ? "Order placed — awaiting payment"
              : "Order placed"}
          </h1>
          <p>
            Order <strong>{done.orderNumber}</strong>
            {done.invoiceNumber ? (
              <>
                {" "}
                · invoice <strong>{done.invoiceNumber}</strong>
              </>
            ) : null}{" "}
            — total {usd.format(done.total)}.
            {done.discountAmount > 0 ? (
              <> Business discount applied: −{usd.format(done.discountAmount)}.</>
            ) : null}{" "}
            {!done.awaitingPayment ? (
              <> Marked as <strong>paid in full</strong> (test checkout).</>
            ) : null}{" "}
            {done.fulfillmentMethod === "pickup" ? (
              <>
                Pickup at <strong>{pickupLocationName}</strong>.
              </>
            ) : (
              <>
                <strong>Shipping</strong> — staff will send tracking when the order ships.
              </>
            )}
          </p>
          {done.awaitingPayment &&
          done.paymentMethod &&
          isOfflinePaymentMethod(done.paymentMethod) ? (
            <div style={{ textAlign: "left", maxWidth: 520, width: "100%", margin: "0 auto" }}>
              <OfflinePaymentDetails
                method={done.paymentMethod}
                store={storeProfile}
                orderNumber={done.orderNumber}
                invoiceNumber={done.invoiceNumber}
                amountDue={done.total}
              />
              <p className="field-hint" style={{ marginTop: 12 }}>
                You can also open{" "}
                <Link className="text-link" href="/account#purchase-history">
                  Account → View invoice
                </Link>{" "}
                anytime for these payment details. Staff will mark the invoice paid after funds
                arrive.
              </p>
            </div>
          ) : null}
          <div className="checkout-actions-row">
            <Link className="button primary" href="/account">
              View orders
            </Link>
            <Link className="button secondary" href="/products">
              Continue shopping
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

  async function submit(forcePaidTest = false) {
    if (placing) return;
    setPlacing(true);
    setError(null);
    try {
      if (method === "ship" && !shippingAddressId) {
        setError("Select a shipping address for delivery orders.");
        return;
      }
      if (needsPhone && !phoneInput.trim()) {
        setError("Please enter a phone number so we can reach you about this order.");
        return;
      }
      if (isBusiness && !forcePaidTest && !isBusinessPaymentMethod(paymentMethod)) {
        setError("Select a payment method.");
        return;
      }

      const result = await Promise.race([
        placeOrder(
          lines.map((line) => ({
            productId: line.product.id,
            quantity: line.quantity,
            note: line.note
          })),
          {
            fulfillmentMethod: method,
            shippingAddressId: method === "ship" ? shippingAddressId : null,
            phone: needsPhone ? phoneInput.trim() : undefined,
            paymentMethod: isBusiness && !forcePaidTest ? paymentMethod : undefined,
            paymentReference:
              isBusiness && !forcePaidTest ? paymentReference.trim() || null : null,
            forcePaidTest
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
          discountAmount: result.discountAmount,
          fulfillmentMethod: result.fulfillmentMethod,
          paymentMethod: result.paymentMethod,
          paymentInstructions: result.paymentInstructions,
          awaitingPayment: result.awaitingPayment,
          isBusinessOrder: result.isBusinessOrder
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
          {isBusiness
            ? "Choose pickup or shipping, then pay by card, check, Zelle, or bank transfer."
            : "Choose pickup or shipping, then place your order."}
        </p>
      </header>

      {isBusiness ? (
        <div className="wholesale-status-banner is-active" role="status" style={{ marginBottom: 16 }}>
          <Building2 size={18} aria-hidden="true" />
          <div>
            <strong>Business discount order</strong>
            <p>
              {companyName ? `${companyName}. ` : ""}
              {businessDiscountPercent != null && businessDiscountPercent > 0
                ? `${businessDiscountPercent}% order discount is applied below. `
                : "Business account — discount % can be set by staff. "}
              You can pay by card, check, Zelle, or bank transfer.
            </p>
          </div>
        </div>
      ) : null}

      {needsPhone ? (
        <section className="form-card" style={{ marginBottom: 18 }}>
          <div className="form-card-heading">
            <div>
              <h2>
                <Phone size={18} aria-hidden="true" /> Contact phone number
              </h2>
              <p>
                We don’t have a phone number on your account yet. Add one so we can reach you about
                this order — we’ll save it to your account for next time.
              </p>
            </div>
          </div>
          <label>
            Phone number *
            <input
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={phoneInput}
              onChange={(e) => setPhoneInput(e.target.value)}
              maxLength={20}
              placeholder="(714) 555-1234"
            />
          </label>
        </section>
      ) : null}

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
              onAddressesChange={setShippingAddresses}
            />
          </div>
        ) : (
          <p className="field-hint" style={{ marginTop: 12 }}>
            Pick up at <strong>{pickupLocationName}</strong> — bring your order number and photo ID.
          </p>
        )}
      </div>

      {isBusiness ? (
        <section className="form-card" style={{ marginBottom: 18 }}>
          <div className="form-card-heading">
            <div>
              <h2>
                <Landmark size={18} aria-hidden="true" /> Payment method
              </h2>
              <p>
                Pay by card (like retail shoppers) or offline — check, Zelle, or bank transfer.
              </p>
            </div>
          </div>
          <div className="fulfillment-choice" style={{ marginBottom: 12 }}>
            {BUSINESS_PAYMENT_METHODS.map((m) => (
              <label key={m}>
                <input
                  type="radio"
                  name="checkout-payment"
                  value={m}
                  checked={paymentMethod === m}
                  onChange={() => setPaymentMethod(m)}
                />
                <span>
                  <strong>
                    {m === "card" ? (
                      <>
                        <CreditCard size={14} aria-hidden="true" style={{ verticalAlign: -2 }} />{" "}
                        {PAYMENT_METHOD_LABELS[m]}
                      </>
                    ) : (
                      PAYMENT_METHOD_LABELS[m]
                    )}
                  </strong>
                  <small>{BUSINESS_PAYMENT_HINTS[m]}</small>
                </span>
              </label>
            ))}
          </div>
          {isOfflinePaymentMethod(paymentMethod) ? (
            <>
              <OfflinePaymentDetails
                method={paymentMethod}
                store={storeProfile}
                amountDue={total}
              />
              <label style={{ marginTop: 12, display: "block" }}>
                Your transfer / check reference (optional)
                <input
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                  maxLength={120}
                  placeholder="Optional: check # or Zelle confirmation id"
                />
                <span className="field-hint">
                  After placing the order, put the <strong>order number</strong> in the Zelle /
                  bank memo (or check memo) so we can match your payment.
                </span>
              </label>
            </>
          ) : null}
        </section>
      ) : null}

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
          <strong>{usd.format(merchandiseSubtotal)}</strong>
        </div>
        {discountAmount > 0 ? (
          <div className="checkout-summary-row muted">
            <span>Business discount ({businessDiscountPercent}%)</span>
            <span>−{usd.format(discountAmount)}</span>
          </div>
        ) : null}
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
        {isBusiness ? (
          <div className="checkout-summary-row muted">
            <span>Pay with</span>
            <span>{PAYMENT_METHOD_LABELS[paymentMethod]}</span>
          </div>
        ) : null}
        <div className="checkout-summary-row total">
          <span>Total</span>
          <strong>{usd.format(total)}</strong>
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
        onClick={() => void submit(false)}
      >
        {placing
          ? "Placing order…"
          : isBusiness
            ? paymentMethod === "card"
              ? "Place order — pay by card"
              : `Place order — pay by ${PAYMENT_METHOD_LABELS[paymentMethod]}`
            : method === "pickup"
              ? "Place order — pickup"
              : "Place order — ship"}
      </button>

      <div className="legal-callout compact" style={{ marginTop: 14 }}>
        <h2>Test checkout</h2>
        <p>
          For testing Orders, Invoices, Payments, and Reports — creates a paid-in-full order
          (not real Stripe). Business offline payment is not required for this button.
        </p>
        <button
          className="button secondary block"
          type="button"
          disabled={placing}
          onClick={() => void submit(true)}
          style={{ marginTop: 10 }}
        >
          {placing ? "Placing order…" : "Place test order — mark as paid"}
        </button>
      </div>

      <Link className="button ghost block" href="/cart">
        Back to cart
      </Link>
    </div>
  );
}
