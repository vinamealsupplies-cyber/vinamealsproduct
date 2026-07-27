"use client";

import { useState } from "react";
import { Receipt, Store, Truck } from "lucide-react";
import { ShippingAddressPicker } from "@/components/shipping-address-picker";
import type { CustomerAddress } from "@/lib/data/address-types";
import { usd } from "@/lib/format";

type FulfillmentMethod = "pickup" | "ship";
type CustomerKind = "retail" | "wholesale";

const SHIPPING_FLAT_RATE = 12.5;

const STORE = { city: "Garden Grove", state: "CA", label: "Vinameals store pickup" };

/**
 * Chọn nhận tại cửa hàng hay giao hàng, kèm tạm tính.
 *
 * THUẾ: cố ý KHÔNG tính ở đây. Cửa hàng thanh toán qua Stripe và dùng
 * Stripe Tax, nên thuế được xác định ở bước checkout dựa trên địa chỉ thật.
 * Shipping address đã lưu dùng để prefill / chọn nơi giao — Stripe Checkout
 * vẫn là nơi xác nhận thuế cuối cùng.
 */
export function FulfillmentPicker({
  retailSubtotal,
  wholesaleSubtotal,
  shippingAddresses = [],
  signedIn = false
}: {
  retailSubtotal: number;
  wholesaleSubtotal: number;
  shippingAddresses?: CustomerAddress[];
  signedIn?: boolean;
}) {
  const [customerKind, setCustomerKind] = useState<CustomerKind>("retail");
  const [method, setMethod] = useState<FulfillmentMethod>("ship");

  const subtotal = customerKind === "retail" ? retailSubtotal : wholesaleSubtotal;
  const shipping = method === "pickup" ? 0 : SHIPPING_FLAT_RATE;
  const beforeTax = subtotal + shipping;

  return (
    <section className="form-card">
      <div className="form-card-heading">
        <div>
          <h2>Pickup or shipping</h2>
          <p>Both options are available to retail and wholesale accounts.</p>
        </div>
      </div>

      <div className="filter-chip-row" role="group" aria-label="Account type">
        {(["retail", "wholesale"] as CustomerKind[]).map((kind) => (
          <button
            key={kind}
            type="button"
            className={customerKind === kind ? "chip-button active" : "chip-button"}
            onClick={() => setCustomerKind(kind)}
          >
            {kind === "retail" ? "Retail pricing" : "Wholesale pricing"}
          </button>
        ))}
      </div>

      <div className="fulfillment-choice">
        <label>
          <input
            type="radio"
            name="fulfillment"
            value="pickup"
            checked={method === "pickup"}
            onChange={() => setMethod("pickup")}
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
            onChange={() => setMethod("ship")}
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
        <ShippingAddressPicker addresses={shippingAddresses} signedIn={signedIn} />
      )}

      <div className="tax-result">
        <div className="tax-result-row">
          <span>Subtotal ({customerKind})</span>
          <strong>{usd.format(subtotal)}</strong>
        </div>
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
