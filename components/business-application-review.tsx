"use client";

import { useActionState, useState } from "react";
import { Check, Download, MessageSquareWarning, X } from "lucide-react";
import {
  addBusinessInternalNote,
  decideBusinessTrack,
  getBusinessDocumentLink
} from "@/app/admin/business-applications/actions";
import { REJECTION_REASONS } from "@/lib/business-application/constants";
import {
  initialBusinessApplicationFormState,
  type BusinessApplication,
  type BusinessApplicationFormState
} from "@/lib/business-application/types";

export function BusinessApplicationReviewPanel({
  application
}: {
  application: BusinessApplication;
}) {
  const [state, action, pending] = useActionState(
    async (prev: BusinessApplicationFormState, formData: FormData) =>
      decideBusinessTrack(prev, formData),
    initialBusinessApplicationFormState
  );
  const [noteState, noteAction, notePending] = useActionState(
    async (prev: BusinessApplicationFormState, formData: FormData) =>
      addBusinessInternalNote(prev, formData),
    initialBusinessApplicationFormState
  );
  const [docMsg, setDocMsg] = useState("");

  async function openDoc(documentId: string) {
    setDocMsg("");
    const result = await getBusinessDocumentLink(documentId);
    if (!result.ok) {
      setDocMsg(result.message);
      return;
    }
    window.open(result.url, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="business-review-panel">
      {state.status !== "idle" ? (
        <div className={state.status === "success" ? "form-success" : "form-error"} role="status">
          {state.message}
        </div>
      ) : null}

      <section className="form-card">
        <div className="form-card-heading">
          <div>
            <h2>Documents</h2>
            <p>Private storage — short-lived signed download links (manager only).</p>
          </div>
        </div>
        {docMsg ? <div className="form-error">{docMsg}</div> : null}
        <ul className="upload-file-list">
          {application.documents.map((doc) => (
            <li key={doc.id}>
              <div>
                <strong>{doc.originalFilename || "Document"}</strong>
                <span>
                  {doc.documentType} · {(doc.fileSize / 1024).toFixed(0)} KB
                </span>
              </div>
              <button
                type="button"
                className="button secondary compact"
                onClick={() => openDoc(doc.id)}
              >
                <Download size={14} /> View securely
              </button>
            </li>
          ))}
        </ul>
      </section>

      {application.wholesaleRequested ? (
        <section className="form-card">
          <div className="form-card-heading">
            <div>
              <h2>Wholesale decision</h2>
              <p>Current: {application.wholesaleStatus}</p>
            </div>
          </div>
          <form className="admin-form" action={action}>
            <input type="hidden" name="applicationId" value={application.id} />
            <input type="hidden" name="track" value="wholesale" />
            <label>
              Reason / note
              <textarea name="reason" rows={2} maxLength={1000} placeholder="Required when rejecting" />
            </label>
            <label>
              Internal note (optional)
              <textarea name="internalNote" rows={2} maxLength={2000} />
            </label>
            <label className="checkbox-label">
              <input type="checkbox" name="shareReason" /> Share reason with customer by email
            </label>
            <div className="button-row">
              <button
                className="button primary"
                type="submit"
                name="decision"
                value="approved"
                disabled={pending}
              >
                <Check size={15} /> Approve business account
              </button>
              <button
                className="button secondary"
                type="submit"
                name="decision"
                value="under_review"
                disabled={pending}
              >
                Mark under review
              </button>
              <button
                className="button secondary danger-button"
                type="submit"
                name="decision"
                value="rejected"
                disabled={pending}
              >
                <X size={15} /> Reject business account
              </button>
              <button
                className="button secondary"
                type="submit"
                name="decision"
                value="suspended"
                disabled={pending}
              >
                Suspend business account
              </button>
            </div>
          </form>
        </section>
      ) : null}

      {application.taxExemptionRequested ? (
        <section className="form-card">
          <div className="form-card-heading">
            <div>
              <h2>Tax exemption decision</h2>
              <p>Current: {application.taxExemptionStatus}</p>
            </div>
          </div>
          <form className="admin-form" action={action}>
            <input type="hidden" name="applicationId" value={application.id} />
            <input type="hidden" name="track" value="tax_exemption" />
            <label>
              Decision reason
              <select name="reasonPreset" defaultValue="" onChange={() => {}}>
                <option value="">Custom reason below…</option>
                {REJECTION_REASONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Reason / request details *
              <textarea
                name="reason"
                rows={3}
                maxLength={1000}
                placeholder="Required for reject / more information"
              />
            </label>
            <label>
              Verification source
              <input name="verificationSource" maxLength={200} placeholder="State portal, call, etc." />
            </label>
            <label>
              Internal note
              <textarea name="internalNote" rows={2} maxLength={2000} />
            </label>
            <label className="checkbox-label">
              <input type="checkbox" name="shareReason" defaultChecked /> Share reason with customer
            </label>
            <div className="button-row">
              <button
                className="button primary"
                type="submit"
                name="decision"
                value="approved"
                disabled={pending}
              >
                <Check size={15} /> Approve tax exemption
              </button>
              <button
                className="button secondary"
                type="submit"
                name="decision"
                value="under_review"
                disabled={pending}
              >
                Under review
              </button>
              <button
                className="button secondary"
                type="submit"
                name="decision"
                value="more_info_required"
                disabled={pending}
              >
                <MessageSquareWarning size={15} /> Request more information
              </button>
              <button
                className="button secondary danger-button"
                type="submit"
                name="decision"
                value="rejected"
                disabled={pending}
              >
                <X size={15} /> Reject tax exemption
              </button>
              <button
                className="button secondary"
                type="submit"
                name="decision"
                value="suspended"
                disabled={pending}
              >
                Suspend exemption
              </button>
              <button
                className="button secondary danger-button"
                type="submit"
                name="decision"
                value="revoked"
                disabled={pending}
              >
                Revoke exemption
              </button>
            </div>
          </form>
        </section>
      ) : null}

      <section className="form-card">
        <div className="form-card-heading">
          <div>
            <h2>Internal notes</h2>
          </div>
        </div>
        {application.internalNotes ? (
          <pre className="internal-notes-block">{application.internalNotes}</pre>
        ) : (
          <p className="field-hint">No internal notes yet.</p>
        )}
        {noteState.status !== "idle" ? (
          <div className={noteState.status === "success" ? "form-success" : "form-error"}>
            {noteState.message}
          </div>
        ) : null}
        <form action={noteAction}>
          <input type="hidden" name="applicationId" value={application.id} />
          <label>
            Add note
            <textarea name="internalNote" required rows={2} maxLength={4000} />
          </label>
          <button className="button secondary" type="submit" disabled={notePending}>
            Add internal note
          </button>
        </form>
      </section>
    </div>
  );
}
