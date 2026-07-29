"use client";

import { useActionState, useState } from "react";
import { Eraser, Save } from "lucide-react";
import {
  clearProfileFieldAction,
  updateProfileAction
} from "@/app/account/profile/actions";
import { initialAdminFormState, type AdminFormState } from "@/lib/data/admin-form";
import { formatUsPhoneDisplay } from "@/lib/data/us-states";

export type ProfileEditorValues = {
  fullName: string;
  email: string;
  phone: string;
  companyName: string;
  role: string;
};

export function ProfileEditor({ initial }: { initial: ProfileEditorValues }) {
  const [notice, setNotice] = useState<AdminFormState>(initialAdminFormState);
  const [fullName, setFullName] = useState(initial.fullName);
  const [phone, setPhone] = useState(initial.phone);
  const [companyName, setCompanyName] = useState(initial.companyName);
  const [synced, setSynced] = useState({
    fullName: initial.fullName,
    phone: initial.phone,
    companyName: initial.companyName
  });

  // Server revalidate → props `initial` đổi → đồng bộ form ngay trong render,
  // thay cho setState trong effect (rule react-hooks/set-state-in-effect).
  if (
    synced.fullName !== initial.fullName ||
    synced.phone !== initial.phone ||
    synced.companyName !== initial.companyName
  ) {
    setSynced({
      fullName: initial.fullName,
      phone: initial.phone,
      companyName: initial.companyName
    });
    setFullName(initial.fullName);
    setPhone(initial.phone);
    setCompanyName(initial.companyName);
  }

  const [, saveAction, saving] = useActionState(
    async (prev: AdminFormState, formData: FormData) => {
      const result = await updateProfileAction(prev, formData);
      setNotice(result);
      return result;
    },
    initialAdminFormState
  );

  const [, clearAction, clearing] = useActionState(
    async (prev: AdminFormState, formData: FormData) => {
      const result = await clearProfileFieldAction(prev, formData);
      setNotice(result);
      if (result.status === "success") {
        const field = String(formData.get("field") ?? "");
        if (field === "name") setFullName("");
        if (field === "phone") setPhone("");
        if (field === "company") setCompanyName("");
      }
      return result;
    },
    initialAdminFormState
  );

  const busy = saving || clearing;

  return (
    <div className="profile-editor form-card">
      <div className="form-card-heading">
        <div>
          <h2>Your profile</h2>
          <p>Add or update your name, phone, and company. Clear a field to remove it.</p>
        </div>
      </div>

      {notice.status !== "idle" ? (
        <div className={notice.status === "success" ? "form-success" : "form-error"} role="status">
          {notice.message}
        </div>
      ) : null}

      <form action={saveAction} className="form-grid two-columns">
        <label className="full-width">
          Full name
          <div className="profile-field-row">
            <input
              name="fullName"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Jane Doe"
              maxLength={120}
              autoComplete="name"
            />
            {fullName ? (
              <button
                className="button secondary compact"
                type="submit"
                formAction={clearAction}
                name="field"
                value="name"
                disabled={busy}
                title="Remove name"
              >
                <Eraser size={14} aria-hidden="true" /> Clear
              </button>
            ) : null}
          </div>
        </label>

        <label className="full-width">
          Email
          <input value={initial.email} disabled readOnly />
          <span className="field-hint">Email comes from your sign-in method and cannot be edited here.</span>
        </label>

        <label>
          Phone
          <div className="profile-field-row">
            <input
              name="phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(714) 555-0134"
              maxLength={40}
              autoComplete="tel"
              inputMode="tel"
            />
            {phone ? (
              <button
                className="button secondary compact"
                type="submit"
                formAction={clearAction}
                name="field"
                value="phone"
                disabled={busy}
                title="Remove phone"
              >
                <Eraser size={14} aria-hidden="true" /> Clear
              </button>
            ) : null}
          </div>
          <span className="field-hint">
            U.S. 10-digit number. Shown to staff on your orders
            {phone ? ` · ${formatUsPhoneDisplay(phone) || phone}` : ""}.
          </span>
        </label>

        <label>
          Company (optional)
          <div className="profile-field-row">
            <input
              name="companyName"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Sunrise Market LLC"
              maxLength={120}
              autoComplete="organization"
            />
            {companyName ? (
              <button
                className="button secondary compact"
                type="submit"
                formAction={clearAction}
                name="field"
                value="company"
                disabled={busy}
                title="Remove company"
              >
                <Eraser size={14} aria-hidden="true" /> Clear
              </button>
            ) : null}
          </div>
        </label>

        <label>
          Account type
          <input value={initial.role} disabled readOnly />
          <span className="field-hint">Role is managed by the store admin.</span>
        </label>

        <div className="full-width button-row">
          <button className="button primary" type="submit" disabled={busy}>
            <Save size={17} aria-hidden="true" />
            {saving ? "Saving…" : "Save profile"}
          </button>
        </div>
      </form>
    </div>
  );
}
