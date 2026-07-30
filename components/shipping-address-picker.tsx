"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
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
  /** Đồng bộ list với parent (cart/checkout bootstrap state). */
  onAddressesChange?: (addresses: CustomerAddress[]) => void;
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
 * Gộp list từ parent với list local — giữ địa chỉ vừa thêm mà parent chưa thấy.
 * Trả về `prev` nguyên vẹn khi không đổi để tránh render thừa.
 */
function mergeFromProps(
  fromProps: CustomerAddress[],
  prev: CustomerAddress[]
): CustomerAddress[] {
  if (fromProps.length === 0 && prev.length === 0) return prev;
  const byId = new Map(prev.map((a) => [a.id, a]));
  // Prop thắng khi trùng id — server là nguồn sự thật.
  for (const a of fromProps) byId.set(a.id, a);
  const merged = Array.from(byId.values()).sort((a, b) => {
    if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
    return (b.createdAt || "").localeCompare(a.createdAt || "");
  });
  if (
    merged.length === prev.length &&
    merged.every((a, i) => a.id === prev[i]?.id && a.isDefault === prev[i]?.isDefault)
  ) {
    return prev;
  }
  return merged;
}

function mergeAddressList(
  current: CustomerAddress[],
  next: CustomerAddress
): CustomerAddress[] {
  const without = current.filter((a) => a.id !== next.id);
  const cleared = next.isDefault
    ? without.map((a) => (a.isDefault ? { ...a, isDefault: false } : a))
    : without;
  // Default + newest first (match server order).
  return [next, ...cleared].sort((a, b) => {
    if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
    return (b.createdAt || "").localeCompare(a.createdAt || "");
  });
}

/**
 * Chọn địa chỉ ship đã lưu khi fulfillment = ship.
 * "Add new address" mở form inline (thay list) — dễ thấy hơn form ẩn dưới.
 */
export function ShippingAddressPicker({
  addresses,
  signedIn,
  selectedId: controlledId,
  onSelect,
  onAddressesChange
}: ShippingAddressPickerProps) {
  const [showForm, setShowForm] = useState(false);
  const [localAddresses, setLocalAddresses] = useState<CustomerAddress[]>(addresses);
  const formWrapRef = useRef<HTMLDivElement>(null);
  const storedId = useSyncExternalStore(subscribe, readStoredId, getServerSnapshot);

  // Sync từ parent khi bootstrap load / refresh — nhưng giữ địa chỉ vừa thêm nếu parent
  // chưa kịp cập nhật (cart/checkout state chỉ load 1 lần).
  //
  // Chỉnh ngay trong render thay vì trong effect: setState trong effect gây cascading
  // render (rule react-hooks/set-state-in-effect). So sánh bằng reference giống hệt
  // dependency array cũ, nên parent render lại mới kích hoạt merge — không lặp vô hạn.
  const [syncedProps, setSyncedProps] = useState(addresses);
  if (addresses !== syncedProps) {
    setSyncedProps(addresses);
    setLocalAddresses((prev) => mergeFromProps(addresses, prev));
  }

  useEffect(() => {
    if (!showForm) return;
    // Form mở → cuộn vào view (cart dài, form dễ bị khuất).
    const id = window.requestAnimationFrame(() => {
      formWrapRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
    return () => window.cancelAnimationFrame(id);
  }, [showForm]);

  const selectedId =
    controlledId !== undefined
      ? resolveSelection(localAddresses, controlledId)
      : resolveSelection(localAddresses, storedId);

  const select = useCallback(
    (id: string | null) => {
      writeStoredId(id);
      onSelect?.(id);
    },
    [onSelect]
  );

  const openForm = useCallback(() => {
    setShowForm(true);
  }, []);

  const closeForm = useCallback(() => {
    setShowForm(false);
  }, []);

  const handleCreated = useCallback(
    (result: AddressFormState) => {
      if (result.status !== "success" || !result.addressId) return;
      if (result.address) {
        setLocalAddresses((prev) => {
          const next = mergeAddressList(prev, result.address!);
          onAddressesChange?.(next);
          return next;
        });
      }
      setShowForm(false);
      select(result.addressId);
    },
    [select, onAddressesChange]
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

  if (showForm) {
    return (
      <div className="shipping-address-block" ref={formWrapRef}>
        <div className="shipping-address-heading">
          <strong>
            <MapPin size={15} aria-hidden="true" /> Add shipping address
          </strong>
          <button className="text-link" type="button" onClick={closeForm}>
            Cancel
          </button>
        </div>
        <div className="shipping-address-form-wrap is-open">
          <AddressForm
            compact
            submitLabel="Save and use this address"
            onCancel={closeForm}
            onSuccess={handleCreated}
          />
        </div>
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

      {localAddresses.length === 0 ? (
        <div className="shipping-address-empty">
          <p className="field-hint">No saved addresses yet. Add one to use at checkout.</p>
          <button className="button secondary compact" type="button" onClick={openForm}>
            <Plus size={15} aria-hidden="true" /> Add new address
          </button>
        </div>
      ) : (
        <ul className="shipping-address-list" role="radiogroup" aria-label="Shipping address">
          {localAddresses.map((address) => {
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
                    onChange={() => select(address.id)}
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
            <button className="text-link" type="button" onClick={openForm}>
              <Plus size={15} aria-hidden="true" /> Add new address
            </button>
          </li>
        </ul>
      )}
    </div>
  );
}
