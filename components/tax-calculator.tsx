"use client";

import { useState } from "react";
import { Calculator, CircleAlert, MapPin } from "lucide-react";
import {
  calculateSalesTax,
  citiesForState,
  formatRate,
  taxStates,
  type TaxCategory
} from "@/lib/tax/calculate";
import { usd } from "@/lib/format";

const categories: { value: TaxCategory; label: string; hint: string }[] = [
  { value: "grocery", label: "Grocery", hint: "Pantry, produce, frozen — exempt or reduced in most states" },
  { value: "prepared_food", label: "Prepared food", hint: "Hot or ready-to-eat items — usually taxed in full" },
  { value: "general", label: "General merchandise", hint: "Non-food items such as cookware or gift boxes" }
];

export function TaxCalculator() {
  const [state, setState] = useState("CA");
  const [city, setCity] = useState("Los Angeles");
  const [amount, setAmount] = useState("100.00");
  const [category, setCategory] = useState<TaxCategory>("grocery");

  const parsedAmount = Number.parseFloat(amount);
  const result = calculateSalesTax(parsedAmount, state, city, category);
  const cities = citiesForState(state);
  const total = Number.isFinite(parsedAmount) ? parsedAmount + result.taxAmount : 0;

  return (
    <section className="form-card">
      <div className="form-card-heading">
        <div>
          <h2>
            <Calculator size={18} aria-hidden="true" /> Check a rate by address
          </h2>
          <p>Enter the delivery city and the rate for that city is applied.</p>
        </div>
      </div>

      <div className="form-grid two-columns">
        <label>
          State
          <select
            value={state}
            onChange={(event) => {
              const nextState = event.target.value;
              setState(nextState);
              setCity(citiesForState(nextState)[0] ?? "");
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
          City
          <input
            list="tax-city-options"
            value={city}
            placeholder="Type any city"
            onChange={(event) => setCity(event.target.value)}
          />
          <datalist id="tax-city-options">
            {cities.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
        </label>

        <label>
          Taxable amount (USD)
          <input
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
        </label>

        <label>
          Item tax category
          <select value={category} onChange={(event) => setCategory(event.target.value as TaxCategory)}>
            {categories.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <p className="field-hint">{categories.find((option) => option.value === category)?.hint}</p>

      {result.matchedOn === "no_jurisdiction" ? (
        <div className="setup-notice warning" role="note">
          <CircleAlert size={18} aria-hidden="true" />
          <div>
            <strong>No rate on file for {state}.</strong>
            <span>Checkout must be blocked rather than charging zero tax. Add a row for this state first.</span>
          </div>
        </div>
      ) : (
        <div className="tax-result">
          <div className="tax-result-row">
            <span>
              <MapPin size={15} aria-hidden="true" /> Matched jurisdiction
            </span>
            <strong>{result.label}</strong>
          </div>
          <div className="tax-result-row">
            <span>Matched on</span>
            <strong>
              {result.matchedOn === "city" ? "Exact city rate" : "State default (no city row yet)"}
            </strong>
          </div>
          <div className="tax-result-row">
            <span>Rate applied</span>
            <strong>{formatRate(result.rate)}</strong>
          </div>
          <div className="tax-result-row">
            <span>Sales tax</span>
            <strong>{usd.format(result.taxAmount)}</strong>
          </div>
          <div className="tax-result-row total">
            <span>Order total</span>
            <strong>{usd.format(total)}</strong>
          </div>
          {result.jurisdiction?.notes ? <p className="field-hint">{result.jurisdiction.notes}</p> : null}
        </div>
      )}
    </section>
  );
}
