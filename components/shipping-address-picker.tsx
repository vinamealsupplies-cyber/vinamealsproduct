"use client";

import Link from "next/link";
import { useCallback, useState, useSyncExternalStore } from "react";
import { MapPin, Plus } from "lucide-react";
import { AddressForm } from "@/components/address-form";
import type { AddressFormState } from "@/lib/data/address-form";
import type { CustomerAddress } from "@/lib/data/address-types";
import { formatAddressMultiline } from "@/lib/data/address-types";

const STORAGE_KEY = "vinameals-shipping-address-id";

type ShippingAddressPickerProps = {
  addresses: CustomerAddress[];
  /** false = guest; hiện link đăng nhập. */
  signedIn: boolean;
  /** Id đang chọn (controlled optional). */
  selectedId?: string | null;
  onSelect?: (addressId: string | null) => void;
};

let memoryId: string | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function readStoredId() {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? memoryId;
  } catch {
    return memoryId;
  }
}

function writeStoredId(id: string | null) {
  memoryId = id;
  try {
    if (id) window.localStorage.setItem(STORAGE_KEY, id);
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // private mode — chọn chỉ trong phiên.
  }
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getServerSnapshot() {
  return null;
}

function resolveSelection(
  addresses: CustomerAddress[],
  preferred: string | null | undefined
) {
  if (preferred && addresses.some((address) => address.id === preferred)) return preferred;
  return addresses.find((address) => address.isDefault)?.id ?? addresses[0]?.id ?? null;
}

/**
 * Chọn địa chỉ ship đã lưu khi fulfillment = ship.
 * Cuối danh sách luôn có "Add new address" mở form inline.
 */
export function ShippingAddressPicker({
  addresses,
  signedIn,
  selectedId: controlledId,
  onSelect
}: ShippingAddressPickerProps) {
  const [showForm, setShowForm] = useState(false);
  const storedId = useSyncExternalStore(subscribe, readStoredId, getServerSnapshot);

  const selectedId =
    controlledId !== undefined
      ? resolveSelection(addresses, controlledId)
      : resolveSelection(addresses, storedId);

  const select = useCallback(
    (id: string | null) => {
      writeStoredId(id);
      onSelect?.(id);
    },
    [onSelect]
  );

  const handleCreated = useCallback(
    (result: AddressFormState) => {
      if (result.status !== "success" || !result.addressId) return;
      setShowForm(false);
      select(result.addressId);
    },
    [select]
  );

  if (!signedIn) {
    return (
      <div className="shipping-address-block">
        <p className="field-hint">
          <MapPin size={14} aria-hidden="true" />{" "}
          <Link className="text-link" href="/login?next=/cart">
            Sign in
          </Link>{" "}
          to save and choose shipping addresses. Guests can still enter an address at checkout.
        </p>
      </div>
    );
  }

  return (
    <div className="shipping-address-block">
      <div className="shipping-address-heading">
        <strong>
          <MapPin size={15} aria-hidden="true" /> Ship to
        </strong>
        <Link className="text-link" href="/account/addresses">
          Manage addresses
        </Link>
      </div>

      {addresses.length === 0 && !showForm ? (
        <p className="field-hint">No saved addresses yet. Add one to use at checkout.</p>
      ) : null}

      {addresses.length > 0 ? (
        <ul className="shipping-address-list" role="radiogroup" aria-label="Shipping address">
          {addresses.map((address) => {
            const lines = formatAddressMultiline(address);
            const checked = selectedId === address.id;
            return (
              <li key={address.id}>
                <label
                  className={
                    checked ? "shipping-address-option selected" : "shipping-address-option"
                  }
                >
                  <input
                    type="radio"
                    name="shippingAddressId"
                    value={address.id}
                    checked={checked}
                    onChange={() => {
                      setShowForm(false);
                      select(address.id);
                    }}
                  />
                  <span>
                    <span className="shipping-address-option-top">
                      {address.label ? (
                        <strong>{address.label}</strong>
                      ) : (
                        <strong>{lines[0]}</strong>
                      )}
                      {address.isDefault ? <span className="status-pill">Default</span> : null}
                    </span>
                    {lines.slice(address.label ? 0 : 1).map((line, index) => (
                      <small key={`${index}-${line}`}>{line}</small>
                    ))}
                  </span>
                </label>
              </li>
            );
          })}

          <li className="shipping-address-add-row">
            <button className="text-link" type="button" onClick={() => setShowForm(true)}>
              <Plus size={15} aria-hidden="true" /> Add new address
            </button>
          </li>
        </ul>
      ) : (
        <button className="text-link" type="button" onClick={() => setShowForm(true)}>
          <Plus size={15} aria-hidden="true" /> Add new address
        </button>
      )}

      {showForm ? (
        <div className="shipping-address-form-wrap">
          <AddressForm
            compact
            submitLabel="Save and use this address"
            onCancel={() => setShowForm(false)}
            onSuccess={handleCreated}
          />
        </div>
      ) : null}
    </div>
  );
}
