"use client";

import { useActionState, useState } from "react";
import { Check, Download, X } from "lucide-react";
import { decideTaxExemption, getDocumentLink } from "@/app/admin/tax-exemptions/actions";
import { initialTaxExemptionState, type TaxExemptionFormState } from "@/lib/data/tax-exemption-form";
import type { TaxExemptionApplication } from "@/lib/data/tax-exemption";

function formatBytes(bytes: number) {
  return bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function TaxExemptionReview({ application }: { application: TaxExemptionApplication }) {
  const [linkError, setLinkError] = useState("");
  const [state, action, pending] = useActionState(decideTaxExemption, initialTaxExemptionState);

  // Tài liệu không có URL công khai: bấm mới xin link ký sống 2 phút.
  async function openDocument(documentId: string) {
    setLinkError("");
    const result = await getDocumentLink(documentId);
    if (!result.ok) {
      setLinkError(result.message);
      return;
    }
    window.open(result.url, "_blank", "noopener,noreferrer");
  }

  const notice: TaxExemptionFormState | null = linkError
    ? { status: "error", message: linkError }
    : state.status !== "idle"
      ? state
      : null;

  const reviewed = application.status !== "pending";

  return (
    <>
      {notice ? (
        <div className={notice.status === "success" ? "form-success" : "form-error"} role="status">
          {notice.message}
        </div>
      ) : null}

      <section className="form-card">
        <div className="form-card-heading">
          <div>
            <h2>Attached documents</h2>
            <p>Links are generated on demand and expire after two minutes.</p>
          </div>
        </div>
        <ul className="upload-file-list">
          {application.documents.map((document) => (
            <li key={document.id}>
              <button className="text-link" type="button" onClick={() => openDocument(document.id)}>
                <Download size={14} aria-hidden="true" /> {document.originalFilename ?? "Document"}
              </button>
              <span className="field-hint">
                {document.contentType} · {formatBytes(document.bytes)}
              </span>
            </li>
          ))}
          {!application.documents.length ? <li>No documents attached.</li> : null}
        </ul>
      </section>

      {reviewed ? (
        <div className="legal-callout compact">
          <h2>Already reviewed</h2>
          <p>
            This application was {application.status}
            {application.reviewNote ? ` — “${application.reviewNote}”` : ""}.
          </p>
        </div>
      ) : (
        <form className="form-card" action={action}>
          <input type="hidden" name="applicationId" value={application.id} />
          {/* `decision` lấy từ chính nút được bấm (name/value) — không dùng
              state, vì setState là bất đồng bộ nên form sẽ submit trước khi
              giá trị kịp vào DOM. */}
          <div className="form-card-heading">
            <div>
              <h2>Decision</h2>
              <p>Approving updates the customer&rsquo;s tax-exempt status immediately.</p>
            </div>
          </div>
          <label>
            Reviewer note
            <textarea name="reviewNote" rows={3} maxLength={500} placeholder="Certificate verified against state records." />
          </label>
          <div className="button-row">
            <button className="button primary" type="submit" name="decision" value="approved" disabled={pending}>
              <Check size={17} aria-hidden="true" /> {pending ? "Saving…" : "Approve exemption"}
            </button>
            <button className="button secondary" type="submit" name="decision" value="rejected" disabled={pending}>
              <X size={16} aria-hidden="true" /> Reject
            </button>
          </div>
        </form>
      )}
    </>
  );
}
