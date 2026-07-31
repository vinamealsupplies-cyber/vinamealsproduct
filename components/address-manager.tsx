"use client";

import { useState } from "react";
import { MapPin, Pencil, Plus, Star, Trash2 } from "lucide-react";
import {
  deleteShippingAddress,
  setDefaultShippingAddress
} from "@/app/(storefront)/account/addresses/actions";
import { AddressForm } from "@/components/address-form";
import type { CustomerAddress } from "@/lib/data/address-types";
import { formatAddressMultiline } from "@/lib/data/address-types";

export function AddressManager({
  addresses,
  openNew = false
}: {
  addresses: CustomerAddress[];
  openNew?: boolean;
}) {
  const [mode, setMode] = useState<"list" | "new" | "edit">(openNew ? "new" : "list");
  const [editing, setEditing] = useState<CustomerAddress | null>(null);

  function startEdit(address: CustomerAddress) {
    setEditing(address);
    setMode("edit");
  }

  function startNew() {
    setEditing(null);
    setMode("new");
  }

  function backToList() {
    setEditing(null);
    setMode("list");
  }

  if (mode === "new" || mode === "edit") {
    return (
      <section className="form-card">
        <AddressForm
          address={mode === "edit" ? editing : null}
          onCancel={backToList}
          onSuccess={() => backToList()}
        />
      </section>
    );
  }

  return (
    <section className="form-card">
      <div className="form-card-heading">
        <div>
          <h2>
            <MapPin size={18} aria-hidden="true" /> Shipping addresses
          </h2>
          <p>Saved U.S. addresses for delivery. Pick one when you ship an order.</p>
        </div>
        <button className="button primary compact" type="button" onClick={startNew}>
          <Plus size={15} aria-hidden="true" /> Add new address
        </button>
      </div>

      {addresses.length === 0 ? (
        <div className="address-empty">
          <MapPin size={28} aria-hidden="true" />
          <p>No shipping addresses yet.</p>
          <button className="button secondary" type="button" onClick={startNew}>
            <Plus size={15} aria-hidden="true" /> Add new address
          </button>
        </div>
      ) : (
        <ul className="address-list">
          {addresses.map((address) => {
            const lines = formatAddressMultiline(address);
            return (
              <li className="address-card" key={address.id}>
                <div className="address-card-body">
                  <div className="address-card-top">
                    {address.label ? <strong className="address-label">{address.label}</strong> : null}
                    {address.isDefault ? (
                      <span className="status-pill status-approved">
                        <Star size={11} aria-hidden="true" /> Default
                      </span>
                    ) : null}
                  </div>
                  {lines.map((line, index) => (
                    <span key={`${index}-${line}`}>{line}</span>
                  ))}
                </div>
                <div className="address-card-actions">
                  {!address.isDefault ? (
                    <form action={setDefaultShippingAddress}>
                      <input type="hidden" name="addressId" value={address.id} />
                      <button className="button secondary compact" type="submit">
                        <Star size={14} aria-hidden="true" /> Set default
                      </button>
                    </form>
                  ) : null}
                  <button
                    className="button secondary compact"
                    type="button"
                    onClick={() => startEdit(address)}
                  >
                    <Pencil size={14} aria-hidden="true" /> Edit
                  </button>
                  <form action={deleteShippingAddress}>
                    <input type="hidden" name="addressId" value={address.id} />
                    <button
                      className="button secondary compact danger-button"
                      type="submit"
                      aria-label={`Delete ${address.label || address.line1}`}
                    >
                      <Trash2 size={14} aria-hidden="true" /> Delete
                    </button>
                  </form>
                </div>
              </li>
            );
          })}
          <li className="address-list-add">
            <button className="text-link" type="button" onClick={startNew}>
              <Plus size={15} aria-hidden="true" /> Add new address
            </button>
          </li>
        </ul>
      )}
    </section>
  );
}
