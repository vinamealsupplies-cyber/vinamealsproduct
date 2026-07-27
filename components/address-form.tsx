"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { MapPin, Save } from "lucide-react";
import {
  createShippingAddress,
  updateShippingAddress
} from "@/app/account/addresses/actions";
import { initialAddressFormState, type AddressFormState } from "@/lib/data/address-form";
import type { CustomerAddress } from "@/lib/data/address-types";
import { formatUsPhoneDisplay, US_STATES } from "@/lib/data/us-states";

type AddressFormProps = {
  /** Khi có → form sửa; không có → form thêm mới. */
  address?: CustomerAddress | null;
  /** Gọi sau khi lưu thành công (cart picker auto-select + đóng form). */
  onSuccess?: (result: AddressFormState) => void;
  onCancel?: () => void;
  /** compact: dùng trong cart; full: trang account. */
  compact?: boolean;
  submitLabel?: string;
};

export function AddressForm({
  address = null,
  onSuccess,
  onCancel,
  compact = false,
  submitLabel
}: AddressFormProps) {
  const router = useRouter();
  const isEdit = Boolean(address);
  const actionFn = isEdit ? updateShippingAddress : createShippingAddress;
  const handledSuccess = useRef<string | null>(null);

  const [state, formAction, pending] = useActionState(
    async (prev: AddressFormState, formData: FormData) => {
      const result = await actionFn(prev, formData);
      return result;
    },
    initialAddressFormState
  );

  useEffect(() => {
    if (state.status !== "success") return;
    const key = state.addressId ?? state.message;
    if (handledSuccess.current === key) return;
    handledSuccess.current = key;
    router.refresh();
    onSuccess?.(state);
  }, [state, onSuccess, router]);

  return (
    <form className={compact ? "address-form compact" : "address-form"} action={formAction}>
      {address ? <input type="hidden" name="addressId" value={address.id} /> : null}

      {state.status !== "idle" ? (
        <div className={state.status === "success" ? "form-success" : "form-error"} role="status">
          {state.message}
        </div>
      ) : null}

      {!compact ? (
        <div className="form-card-heading">
          <div>
            <h2>
              <MapPin size={18} aria-hidden="true" />{" "}
              {isEdit ? "Edit shipping address" : "Add shipping address"}
            </h2>
            <p>United States addresses only. Used when you choose ship-to-address.</p>
          </div>
          <span className="required-note">* Required</span>
        </div>
      ) : null}

      <div className="form-grid two-columns">
        <label>
          Recipient name *
          <input
            name="recipientName"
            required
            autoComplete="shipping name"
            defaultValue={address?.recipientName ?? ""}
            placeholder="Jane Doe"
            maxLength={120}
          />
        </label>

        <label>
          Phone *
          <input
            name="phone"
            type="tel"
            required
            autoComplete="shipping tel"
            defaultValue={formatUsPhoneDisplay(address?.phone) || (address?.phone ?? "")}
            placeholder="(714) 555-1234"
            inputMode="tel"
            maxLength={20}
          />
        </label>

        <label>
          Company (optional)
          <input
            name="companyName"
            autoComplete="shipping organization"
            defaultValue={address?.companyName ?? ""}
            placeholder="Business name"
            maxLength={120}
          />
        </label>

        <label>
          Label (optional)
          <input
            name="label"
            defaultValue={address?.label ?? ""}
            placeholder="Home, Office…"
            maxLength={60}
          />
        </label>

        <label className="full-width">
          Street address *
          <input
            name="line1"
            required
            autoComplete="shipping address-line1"
            defaultValue={address?.line1 ?? ""}
            placeholder="123 Main St"
            maxLength={160}
          />
        </label>

        <label className="full-width">
          Apt, suite, unit (optional)
          <input
            name="line2"
            autoComplete="shipping address-line2"
            defaultValue={address?.line2 ?? ""}
            placeholder="Apt 4B"
            maxLength={160}
          />
        </label>

        <label>
          City *
          <input
            name="city"
            required
            autoComplete="shipping address-level2"
            defaultValue={address?.city ?? ""}
            placeholder="Garden Grove"
            maxLength={80}
          />
        </label>

        <label>
          State *
          <select
            name="stateRegion"
            required
            autoComplete="shipping address-level1"
            defaultValue={address?.stateRegion ?? "CA"}
          >
            {US_STATES.map((state) => (
              <option key={state.code} value={state.code}>
                {state.code} — {state.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          ZIP code *
          <input
            name="postalCode"
            required
            autoComplete="shipping postal-code"
            defaultValue={address?.postalCode ?? ""}
            placeholder="92840"
            inputMode="numeric"
            pattern="\d{5}(-\d{4})?"
            title="12345 or 12345-6789"
            maxLength={10}
          />
        </label>

        <label>
          Country
          <input value="United States" disabled readOnly aria-readonly="true" />
        </label>
      </div>

      <div className="checkbox-row">
        <label className="checkbox-label">
          <input
            type="checkbox"
            name="isDefault"
            defaultChecked={address?.isDefault ?? false}
          />
          Set as default shipping address
        </label>
      </div>

      <div className="address-form-actions">
        {onCancel ? (
          <button className="button secondary" type="button" onClick={onCancel} disabled={pending}>
            Cancel
          </button>
        ) : null}
        <button className="button primary" type="submit" disabled={pending}>
          <Save size={16} aria-hidden="true" />
          {pending ? "Saving…" : submitLabel ?? (isEdit ? "Save changes" : "Save address")}
        </button>
      </div>
    </form>
  );
}
