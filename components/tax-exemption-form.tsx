"use client";

import { useActionState, useState } from "react";
import { FileUp, Send, ShieldCheck } from "lucide-react";
import { submitTaxExemptionApplication } from "@/app/(storefront)/account/tax-exemption/actions";
import { initialTaxExemptionState, type TaxExemptionFormState } from "@/lib/data/tax-exemption-form";

const MAX_FILES = 3;
const MAX_MB = 5;

export function TaxExemptionForm({
  defaults
}: {
  defaults: { contactName: string; businessName: string; email: string; phone: string };
}) {
  const [fileNames, setFileNames] = useState<string[]>([]);
  const [clientError, setClientError] = useState("");
  const [formKey, setFormKey] = useState(0);

  const [state, action, pending] = useActionState(
    async (prev: TaxExemptionFormState, formData: FormData) => {
      const result = await submitTaxExemptionApplication(prev, formData);
      if (result.status === "success") {
        setFileNames([]);
        setFormKey((key) => key + 1);
      }
      return result;
    },
    initialTaxExemptionState
  );

  // Kiểm tra nhanh phía trình duyệt cho đỡ mất công gửi lên; máy chủ vẫn kiểm
  // tra lại toàn bộ (kể cả magic bytes) vì client luôn có thể bị bỏ qua.
  function handleFiles(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (files.length > MAX_FILES) {
      setClientError(`Attach at most ${MAX_FILES} files.`);
      event.target.value = "";
      setFileNames([]);
      return;
    }
    const tooBig = files.find((file) => file.size > MAX_MB * 1024 * 1024);
    if (tooBig) {
      setClientError(`"${tooBig.name}" is larger than ${MAX_MB} MB.`);
      event.target.value = "";
      setFileNames([]);
      return;
    }
    setClientError("");
    setFileNames(files.map((file) => file.name));
  }

  const notice = clientError
    ? { status: "error" as const, message: clientError }
    : state.status !== "idle"
      ? state
      : null;

  return (
    <form className="admin-form" action={action} key={formKey}>
      {notice ? (
        <div className={notice.status === "success" ? "form-success" : "form-error"} role="status">
          {notice.message}
        </div>
      ) : null}

      <section className="form-card">
        <div className="form-card-heading">
          <div>
            <h2>Business details</h2>
            <p>We use this to match your exemption certificate to your account.</p>
          </div>
          <span className="required-note">* Required</span>
        </div>
        <div className="form-grid two-columns">
          <label>
            Your name *
            <input name="contactName" required defaultValue={defaults.contactName} placeholder="Jane Doe" />
          </label>
          <label>
            Business name *
            <input name="businessName" required defaultValue={defaults.businessName} placeholder="Sunrise Market LLC" />
          </label>
          <label>
            Email *
            <input name="email" type="email" required defaultValue={defaults.email} placeholder="orders@business.example" />
          </label>
          <label>
            Phone *
            <input name="phone" required defaultValue={defaults.phone} placeholder="(714) 555-0134" />
          </label>
        </div>
      </section>

      <section className="form-card">
        <div className="form-card-heading">
          <div>
            <h2>Exemption certificate</h2>
            <p>Attach your seller&rsquo;s permit, resale certificate, or state exemption letter.</p>
          </div>
        </div>

        <label className="upload-drop">
          <FileUp size={20} aria-hidden="true" />
          <span>Choose files</span>
          <input
            className="visually-hidden"
            type="file"
            name="documents"
            multiple
            required
            accept="application/pdf,image/jpeg,image/png,image/webp"
            onChange={handleFiles}
          />
        </label>
        <p className="field-hint">PDF, JPEG, PNG, or WebP · up to {MAX_MB} MB each · max {MAX_FILES} files</p>

        {fileNames.length ? (
          <ul className="upload-file-list">
            {fileNames.map((name) => (
              <li key={name}>{name}</li>
            ))}
          </ul>
        ) : null}

        <p className="payment-note">
          <ShieldCheck size={15} aria-hidden="true" /> Documents are stored privately and are only visible to
          authorized staff reviewing your application.
        </p>
      </section>

      <div className="sticky-form-actions">
        <button className="button primary" type="submit" disabled={pending}>
          <Send size={17} aria-hidden="true" /> {pending ? "Submitting…" : "Submit application"}
        </button>
      </div>
    </form>
  );
}
