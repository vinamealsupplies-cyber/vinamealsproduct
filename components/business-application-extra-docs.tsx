"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Upload } from "lucide-react";
import {
  BUSINESS_DOC_ACCEPTED_LABEL,
  DOCUMENT_TYPES,
  MAX_BUSINESS_DOC_BYTES,
  MAX_BUSINESS_DOCS
} from "@/lib/business-application/constants";
import { uploadAdditionalBusinessDocuments } from "@/app/account/business-application/actions";
import {
  initialBusinessApplicationFormState,
  type BusinessApplicationFormState
} from "@/lib/business-application/types";

export function AdditionalDocumentsForm({
  applicationId,
  highlight
}: {
  applicationId: string;
  highlight?: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [state, setState] = useState<BusinessApplicationFormState>(
    initialBusinessApplicationFormState
  );
  const [docType, setDocType] = useState<string>(DOCUMENT_TYPES[0]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const formData = new FormData(event.currentTarget);
    formData.set("applicationId", applicationId);
    formData.set("documentType_0", docType);
    setPending(true);
    try {
      const result = await uploadAdditionalBusinessDocuments(
        initialBusinessApplicationFormState,
        formData
      );
      setState(result);
      if (result.status === "success") router.refresh();
    } catch {
      setState({ status: "error", message: "Upload failed. Please try again." });
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      className={highlight ? "additional-docs-form needs-info" : "additional-docs-form"}
      onSubmit={onSubmit}
      style={{ marginTop: 16 }}
    >
      {highlight ? (
        <p className="form-error" role="status">
          More information is required. Upload the requested documents below.
        </p>
      ) : (
        <p className="field-hint">Upload additional supporting documents if needed.</p>
      )}
      {state.status !== "idle" ? (
        <div className={state.status === "success" ? "form-success" : "form-error"} role="status">
          {state.message}
        </div>
      ) : null}
      <div className="form-grid two-columns">
        <label>
          Document type
          <select value={docType} onChange={(e) => setDocType(e.target.value)}>
            {DOCUMENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label>
          Files (max {MAX_BUSINESS_DOCS}, {Math.floor(MAX_BUSINESS_DOC_BYTES / (1024 * 1024))} MB each)
          <input
            name="documents"
            type="file"
            required
            multiple
            accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
          />
          <span className="field-hint">{BUSINESS_DOC_ACCEPTED_LABEL}</span>
        </label>
      </div>
      <button className="button primary" type="submit" disabled={pending} style={{ marginTop: 12 }}>
        {pending ? (
          <>
            <Loader2 size={16} className="spin" /> Uploading…
          </>
        ) : (
          <>
            <Upload size={16} /> Upload additional document
          </>
        )}
      </button>
    </form>
  );
}
