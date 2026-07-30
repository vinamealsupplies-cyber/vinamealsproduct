"use client";

import { BadgeDollarSign, Receipt, Store, Truck } from "lucide-react";
import { ShippingAddressPicker } from "@/components/shipping-address-picker";
import type { CustomerAddress } from "@/lib/data/address-types";
import {
  setFulfillmentMethod,
  useFulfillmentMethod,
  type FulfillmentMethod
} from "@/lib/fulfillment-preference";
import { usd } from "@/lib/format";

const SHIPPING_FLAT_RATE = 12.5;

const STORE = { city: "Garden Grove", state: "CA", label: "Vinameals store pickup" };

/**
 * Pickup vs ship + estimate. Business accounts may show order-level discount %
 * (not SKU wholesale prices). Tax calculated at checkout later.
 */
export function FulfillmentPicker({
  retailSubtotal,
  businessDiscount = 0,
  isBusiness = false,
  businessDiscountPercent = null,
  shippingAddresses = [],
  onShippingAddressesChange,
  signedIn = false
}: {
  retailSubtotal: number;
  businessDiscount?: number;
  isBusiness?: boolean;
  businessDiscountPercent?: number | null;
  shippingAddresses?: CustomerAddress[];
  onShippingAddressesChange?: (addresses: CustomerAddress[]) => void;
  signedIn?: boolean;
}) {
  const method = useFulfillmentMethod();

  function choose(next: FulfillmentMethod) {
    setFulfillmentMethod(next);
  }

  const subtotal = Math.max(0, retailSubtotal - businessDiscount);
  const shipping = method === "pickup" ? 0 : SHIPPING_FLAT_RATE;
  const beforeTax = subtotal + shipping;

  return (
    <section className="form-card">
      <div className="form-card-heading">
        <div>
          <h2>Pickup or shipping</h2>
          <p>
            {isBusiness
              ? "Business accounts can pay by card or offline (check / Zelle / bank transfer) at checkout."
              : "Choose how you want to receive your order."}
          </p>
        </div>
      </div>

      {isBusiness ? (
        <div className="wholesale-status-banner is-active" role="status">
          <BadgeDollarSign size={18} aria-hidden="true" />
          <div>
            <strong>Business discount order</strong>
            <p>
              {businessDiscountPercent != null && businessDiscountPercent > 0
                ? `${businessDiscountPercent}% discount will apply at checkout. `
                : "Your account is approved for business orders. "}
              Pay by card (like retail) or offline — staff confirms check / Zelle / bank transfer.
            </p>
          </div>
        </div>
      ) : null}

      <div className="fulfillment-choice">
        <label>
          <input
            type="radio"
            name="fulfillment"
            value="pickup"
            checked={method === "pickup"}
            onChange={() => choose("pickup")}
          />
          <span>
            <strong>
              <Store size={15} aria-hidden="true" /> Store pickup
            </strong>
            <small>
              No shipping fee. Collect at {STORE.city}, {STORE.state}.
            </small>
          </span>
        </label>

        <label>
          <input
            type="radio"
            name="fulfillment"
            value="ship"
            checked={method === "ship"}
            onChange={() => choose("ship")}
          />
          <span>
            <strong>
              <Truck size={15} aria-hidden="true" /> Ship to address
            </strong>
            <small>Flat {usd.format(SHIPPING_FLAT_RATE)} placeholder rate.</small>
          </span>
        </label>
      </div>

      {method === "pickup" ? (
        <p className="field-hint">
          Pick up at <strong>{STORE.label}</strong> — bring your order number and a photo ID.
        </p>
      ) : (
        <ShippingAddressPicker
          addresses={shippingAddresses}
          signedIn={signedIn}
          onAddressesChange={onShippingAddressesChange}
        />
      )}

      <div className="tax-result">
        <div className="tax-result-row">
          <span>Subtotal</span>
          <strong>{usd.format(retailSubtotal)}</strong>
        </div>
        {businessDiscount > 0 ? (
          <div className="tax-result-row muted">
            <span>Business discount</span>
            <span>−{usd.format(businessDiscount)}</span>
          </div>
        ) : null}
        <div className="tax-result-row">
          <span>Shipping</span>
          <strong>{shipping === 0 ? "Free (pickup)" : usd.format(shipping)}</strong>
        </div>
        <div className="tax-result-row">
          <span>Sales tax</span>
          <strong>Calculated at checkout</strong>
        </div>
        <div className="tax-result-row total">
          <span>Total before tax</span>
          <strong>{usd.format(beforeTax)}</strong>
        </div>
        <p className="field-hint">
          <Receipt size={14} aria-hidden="true" /> Sales tax is calculated at checkout from your
          delivery or pickup address. Approved tax-exempt accounts are charged no sales tax.
        </p>
      </div>
    </section>
  );
}
