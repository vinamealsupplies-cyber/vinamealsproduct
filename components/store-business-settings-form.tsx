"use client";

import { useActionState } from "react";
import { Building2, Landmark, Save } from "lucide-react";
import { saveBusinessInvoiceProfileAction } from "@/app/admin/settings/actions";
import { initialAdminFormState, type AdminFormState } from "@/lib/data/admin-form";
import type { StoreBusinessProfile } from "@/lib/store-profile";

export function StoreBusinessSettingsForm({
  initial
}: {
  initial: StoreBusinessProfile;
}) {
  const [state, action, pending] = useActionState(
    async (prev: AdminFormState, formData: FormData) =>
      saveBusinessInvoiceProfileAction(prev, formData),
    initialAdminFormState
  );

  return (
    <form className="admin-form" action={action}>
      {state.status !== "idle" ? (
        <div className={state.status === "success" ? "form-success" : "form-error"} role="status">
          {state.message}
        </div>
      ) : null}

      <section className="form-card">
        <div className="form-card-heading">
          <div>
            <h2>
              <Building2 size={18} aria-hidden="true" /> Company identity
            </h2>
            <p>
              Shown at the top of customer invoices (logo, legal name, address). This is your store —
              not a customer business account.
            </p>
          </div>
          <span className="required-note">* Required</span>
        </div>
        <div className="form-grid two-columns">
          <label>
            Legal business name *
            <input name="legalName" required defaultValue={initial.legalName} maxLength={160} />
          </label>
          <label>
            Display name
            <input name="displayName" defaultValue={initial.displayName} maxLength={160} />
          </label>
          <label className="full-width">
            Street address
            <input name="addressLine1" defaultValue={initial.addressLine1} maxLength={160} />
          </label>
          <label className="full-width">
            Address line 2
            <input name="addressLine2" defaultValue={initial.addressLine2} maxLength={160} />
          </label>
          <label>
            City
            <input name="city" defaultValue={initial.city} maxLength={80} />
          </label>
          <label>
            State
            <input name="state" defaultValue={initial.state} maxLength={40} placeholder="CA" />
          </label>
          <label>
            ZIP
            <input name="postalCode" defaultValue={initial.postalCode} maxLength={20} />
          </label>
          <label>
            Country
            <input name="country" defaultValue={initial.country || "US"} maxLength={40} />
          </label>
          <label>
            Phone
            <input name="phone" type="tel" defaultValue={initial.phone} maxLength={40} />
          </label>
          <label>
            Support email
            <input name="email" type="email" defaultValue={initial.email} maxLength={160} />
          </label>
          <label>
            Website
            <input name="website" type="url" defaultValue={initial.website} maxLength={200} />
          </label>
          <label>
            Logo path
            <input
              name="logoPath"
              defaultValue={initial.logoPath}
              maxLength={200}
              placeholder="/logo-vinameals.png"
            />
            <span className="field-hint">Public path under /public (e.g. /logo-vinameals.png).</span>
          </label>
          <label className="full-width">
            Payment terms note (invoice)
            <textarea
              name="paymentTermsNote"
              rows={2}
              maxLength={1000}
              defaultValue={initial.paymentTermsNote}
            />
          </label>
        </div>
      </section>

      <section className="form-card">
        <div className="form-card-heading">
          <div>
            <h2>
              <Landmark size={18} aria-hidden="true" /> Offline payment details
            </h2>
            <p>
              Shown on invoices when customers pay by check, Zelle, or bank transfer. Keep bank
              details accurate — only the customer who owns the order can open their invoice.
            </p>
          </div>
        </div>
        <div className="form-grid two-columns">
          <label>
            Checks payable to
            <input name="checkPayableTo" defaultValue={initial.checkPayableTo} maxLength={160} />
          </label>
          <label>
            Make checks payable to (footer)
            <input name="payableTo" defaultValue={initial.payableTo} maxLength={160} />
          </label>
          <label className="full-width">
            Check mailing / drop-off note
            <textarea
              name="checkMailingNote"
              rows={2}
              maxLength={500}
              defaultValue={initial.checkMailingNote}
            />
          </label>

          <label>
            Zelle name
            <input name="zelleName" defaultValue={initial.zelleName} maxLength={120} />
          </label>
          <label>
            Zelle email or phone
            <input
              name="zelleEmailOrPhone"
              defaultValue={initial.zelleEmailOrPhone}
              maxLength={120}
              placeholder="orders@… or (714) …"
            />
          </label>
          <label className="full-width">
            Zelle instructions
            <textarea
              name="zelleInstructions"
              rows={2}
              maxLength={500}
              defaultValue={initial.zelleInstructions}
            />
          </label>

          <label>
            Bank name
            <input name="bankName" defaultValue={initial.bankName} maxLength={120} />
          </label>
          <label>
            Account name
            <input name="bankAccountName" defaultValue={initial.bankAccountName} maxLength={160} />
          </label>
          <label>
            Routing number
            <input
              name="bankRoutingNumber"
              defaultValue={initial.bankRoutingNumber}
              maxLength={40}
              autoComplete="off"
            />
          </label>
          <label>
            Account number
            <input
              name="bankAccountNumber"
              defaultValue={initial.bankAccountNumber}
              maxLength={40}
              autoComplete="off"
            />
          </label>
          <label>
            Account type
            <select name="bankAccountType" defaultValue={initial.bankAccountType || "checking"}>
              <option value="checking">Checking</option>
              <option value="savings">Savings</option>
            </select>
          </label>
          <label className="full-width">
            Bank transfer instructions
            <textarea
              name="bankInstructions"
              rows={2}
              maxLength={500}
              defaultValue={initial.bankInstructions}
            />
          </label>
        </div>
      </section>

      <div className="sticky-form-actions">
        <button className="button primary" type="submit" disabled={pending}>
          <Save size={17} aria-hidden="true" />
          {pending ? "Saving…" : "Save business information"}
        </button>
      </div>
    </form>
  );
}
