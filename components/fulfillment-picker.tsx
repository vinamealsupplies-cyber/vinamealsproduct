"use client";

import { useState } from "react";
import { Store, Truck } from "lucide-react";
import { calculateSalesTax, citiesForState, formatRate, taxStates } from "@/lib/tax/calculate";
import { usd } from "@/lib/format";

type FulfillmentMethod = "pickup" | "ship";
type CustomerKind = "retail" | "wholesale";

const SHIPPING_FLAT_RATE = 12.5;

// Địa chỉ cửa hàng quyết định thuế cho đơn nhận tại chỗ.
const STORE = { city: "Garden Grove", state: "CA", label: "Vinameals store pickup" };

export function FulfillmentPicker({
  retailSubtotal,
  wholesaleSubtotal
}: {
  retailSubtotal: number;
  wholesaleSubtotal: number;
}) {
  const [customerKind, setCustomerKind] = useState<CustomerKind>("retail");
  const [method, setMethod] = useState<FulfillmentMethod>("ship");
  const [state, setState] = useState("CA");
  const [city, setCity] = useState("Los Angeles");

  const subtotal = customerKind === "retail" ? retailSubtotal : wholesaleSubtotal;

  // Nhận tại cửa hàng -> thuế theo địa chỉ cửa hàng, không phí ship.
  const taxCity = method === "pickup" ? STORE.city : city;
  const taxState = method === "pickup" ? STORE.state : state;
  const shipping = method === "pickup" ? 0 : SHIPPING_FLAT_RATE;

  const tax = calculateSalesTax(subtotal, taxState, taxCity, "grocery");
  const total = subtotal + shipping + tax.taxAmount;

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
            <small>No shipping fee. Tax follows the store address in {STORE.city}, {STORE.state}.</small>
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
            <small>Flat {usd.format(SHIPPING_FLAT_RATE)} placeholder. Tax follows the delivery city.</small>
          </span>
        </label>
      </div>

      {method === "ship" ? (
        <div className="form-grid two-columns">
          <label>
            Delivery state
            <select
              value={state}
              onChange={(event) => {
                const next = event.target.value;
                setState(next);
                setCity(citiesForState(next)[0] ?? "");
              }}
            >
              {taxStates.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </select>
          </label>
          <label>
            Delivery city
            <input
              list="fulfillment-city-options"
              value={city}
              placeholder="Type any city"
              onChange={(event) => setCity(event.target.value)}
            />
            <datalist id="fulfillment-city-options">
              {citiesForState(state).map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          </label>
        </div>
      ) : (
        <p className="field-hint">
          Pick up at <strong>{STORE.label}</strong> — bring your order number and a photo ID.
        </p>
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
          <span>
            Sales tax {tax.label ? `— ${tax.label}` : ""} {tax.rate > 0 ? `(${formatRate(tax.rate)})` : ""}
          </span>
          <strong>{usd.format(tax.taxAmount)}</strong>
        </div>
        <div className="tax-result-row total">
          <span>Estimated total</span>
          <strong>{usd.format(total)}</strong>
        </div>
        {tax.rate === 0 && tax.matchedOn !== "no_jurisdiction" ? (
          <p className="field-hint">
            Groceries are not taxed in this jurisdiction. Prepared or non-food items on the same order would
            still be taxed at the general rate.
          </p>
        ) : null}
      </div>
    </section>
  );
}
