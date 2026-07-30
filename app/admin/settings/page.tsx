import type { Metadata } from "next";
import { AdminPageHeader } from "@/components/admin-page-header";
import { StoreBusinessSettingsForm } from "@/components/store-business-settings-form";
import { requireStaffPage } from "@/lib/auth";
import { getStoreBusinessProfile } from "@/lib/data/store-settings";

export const metadata: Metadata = { title: "Store settings" };

export default async function SettingsPage() {
  const viewer = await requireStaffPage();
  const profile = await getStoreBusinessProfile();
  const canEdit = viewer.isManager;

  return (
    <>
      <AdminPageHeader
        eyebrow="Configuration"
        title="Store settings"
        description="Business information printed on customer invoices, including Zelle and bank transfer details."
      />

      {!canEdit ? (
        <div className="legal-callout compact">
          <h2>View only</h2>
          <p>
            Staff can review these fields. Only managers and admins can save changes to company
            payment details.
          </p>
        </div>
      ) : null}

      {canEdit ? (
        <StoreBusinessSettingsForm initial={profile} />
      ) : (
        <section className="form-card">
          <div className="form-card-heading">
            <div>
              <h2>{profile.legalName || "Store"}</h2>
              <p>Current invoice identity (read-only).</p>
            </div>
          </div>
          <dl className="detail-list">
            <div>
              <dt>Email / phone</dt>
              <dd>
                {profile.email || "—"} · {profile.phone || "—"}
              </dd>
            </div>
            <div>
              <dt>Address</dt>
              <dd>
                {[profile.addressLine1, profile.addressLine2, profile.city, profile.state, profile.postalCode]
                  .filter(Boolean)
                  .join(", ") || "—"}
              </dd>
            </div>
            <div>
              <dt>Zelle</dt>
              <dd>
                {profile.zelleName || profile.zelleEmailOrPhone
                  ? [profile.zelleName, profile.zelleEmailOrPhone].filter(Boolean).join(" · ")
                  : "Not set"}
              </dd>
            </div>
            <div>
              <dt>Bank</dt>
              <dd>
                {profile.bankName
                  ? `${profile.bankName} · ${profile.bankAccountName || "—"}`
                  : "Not set"}
              </dd>
            </div>
          </dl>
        </section>
      )}
    </>
  );
}
