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
import type { WholesaleEligibility } from "@/lib/wholesale";

const SHIPPING_FLAT_RATE = 12.5;

const STORE = { city: "Garden Grove", state: "CA", label: "Vinameals store pickup" };

/**
 * Chọn nhận tại cửa hàng hay giao hàng, kèm tạm tính.
 * Lựa chọn được lưu localStorage và checkout đọc lại.
 *
 * Wholesale pricing CHỈ hiện khi admin gán mác wholesale và giỏ đạt ngưỡng
 * (số lượng hoặc số tiền). Khách lẻ không còn nút bấm để xem/chọn giá sỉ.
 *
 * THUẾ: không tính ở đây — Stripe Tax ở checkout.
 */
export function FulfillmentPicker({
  retailSubtotal,
  wholesaleSubtotal,
  wholesale,
  shippingAddresses = [],
  signedIn = false
}: {
  retailSubtotal: number;
  /** Tổng nếu áp giá sỉ (chỉ meaningful khi wholesale.isWholesale). */
  wholesaleSubtotal: number;
  wholesale: WholesaleEligibility;
  shippingAddresses?: CustomerAddress[];
  signedIn?: boolean;
}) {
  const method = useFulfillmentMethod();

  function choose(next: FulfillmentMethod) {
    setFulfillmentMethod(next);
  }

  const useWholesale = wholesale.isWholesale && wholesale.qualifies;
  const subtotal = useWholesale ? wholesaleSubtotal : retailSubtotal;
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

      {wholesale.isWholesale ? (
        <div
          className={`wholesale-status-banner ${useWholesale ? "is-active" : "is-locked"}`}
          role="status"
        >
          <BadgeDollarSign size={18} aria-hidden="true" />
          <div>
            {useWholesale ? (
              <>
                <strong>Wholesale pricing applied</strong>
                <p>
                  Your account is marked wholesale and this cart meets the minimum
                  {wholesale.minKind === "quantity" && wholesale.minValue != null
                    ? ` (${wholesale.minValue} items)`
                    : wholesale.minKind === "amount" && wholesale.minValue != null
                      ? ` ($${wholesale.minValue.toFixed(2)})`
                      : ""}
                  .
                </p>
              </>
            ) : (
              <>
                <strong>Wholesale pricing locked</strong>
                <p>
                  {wholesale.message ??
                    "Add more items to unlock your wholesale prices on this order."}
                </p>
              </>
            )}
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
        <ShippingAddressPicker addresses={shippingAddresses} signedIn={signedIn} />
      )}

      <div className="tax-result">
        <div className="tax-result-row">
          <span>Subtotal {useWholesale ? "(wholesale)" : "(retail)"}</span>
          <strong>{usd.format(subtotal)}</strong>
        </div>
        {wholesale.isWholesale && !useWholesale && wholesaleSubtotal < retailSubtotal ? (
          <div className="tax-result-row muted">
            <span>If wholesale unlocked</span>
            <span>{usd.format(wholesaleSubtotal)}</span>
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
