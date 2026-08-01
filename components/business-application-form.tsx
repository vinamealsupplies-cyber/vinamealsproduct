"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileUp, Loader2, Send, ShieldCheck, Trash2 } from "lucide-react";
import {
  BUSINESS_DOC_ACCEPTED_LABEL,
  DOCUMENT_TYPES,
  EXEMPTION_TYPES,
  MAX_BUSINESS_DOC_BYTES,
  MAX_BUSINESS_DOCS,
  TAX_STATUS_LABELS,
  WHOLESALE_STATUS_LABELS
} from "@/lib/business-application/constants";
import {
  initialBusinessApplicationFormState,
  type ApplicationTypeChoice,
  type BusinessApplicationFormState
} from "@/lib/business-application/types";
import { formatUsPhoneDisplay, US_STATES } from "@/lib/data/us-states";

type Defaults = {
  fullName: string;
  email: string;
  phone: string;
  companyName: string;
};

type PendingFile = {
  id: string;
  file: File;
  documentType: string;
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function BusinessApplicationForm({ defaults }: { defaults: Defaults }) {
  const router = useRouter();
  const [applicationType, setApplicationType] = useState<ApplicationTypeChoice>("both");
  const wholesaleOn = applicationType === "wholesale" || applicationType === "both";
  const taxOn = applicationType === "tax" || applicationType === "both";

  const [exemptionType, setExemptionType] = useState<string>(EXEMPTION_TYPES[0]);
  const [files, setFiles] = useState<PendingFile[]>([]);
  const [pending, setPending] = useState(false);
  const [state, setState] = useState<BusinessApplicationFormState>(
    initialBusinessApplicationFormState
  );
  const [clientError, setClientError] = useState("");
  const [signerName, setSignerName] = useState(defaults.fullName);

  const needsPermitNumber = !["Nonprofit exemption", "Government exemption", "Other"].includes(
    exemptionType
  );

  function onPickFiles(event: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!picked.length) return;

    setClientError("");
    setFiles((prev) => {
      const next = [...prev];
      for (const file of picked) {
        if (next.length >= MAX_BUSINESS_DOCS) {
          setClientError(`Upload at most ${MAX_BUSINESS_DOCS} files.`);
          break;
        }
        if (file.size > MAX_BUSINESS_DOC_BYTES) {
          setClientError(`"${file.name}" exceeds the 10 MB limit.`);
          continue;
        }
        next.push({
          id: `${file.name}-${file.size}-${file.lastModified}-${Math.random()}`,
          file,
          documentType: DOCUMENT_TYPES[0]
        });
      }
      return next;
    });
  }

  function removeFile(id: string) {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setClientError("");
    setState(initialBusinessApplicationFormState);

    if (!files.length) {
      setClientError("Please upload at least one supporting document.");
      return;
    }

    const form = event.currentTarget;
    const formData = new FormData(form);
    formData.set("applicationType", applicationType);
    // Địa chỉ liên hệ = địa chỉ doanh nghiệp (đã gọn form, không hỏi riêng).
    formData.set("mailingSameAsBusiness", "true");
    formData.set("shippingSameAsBusiness", "true");
    formData.set("certificateSameAsBusiness", "true");

    // Files + types
    formData.delete("documents");
    files.forEach((item, index) => {
      formData.append("documents", item.file);
      formData.set(`documentType_${index}`, item.documentType);
    });

    setPending(true);
    try {
      const res = await fetch("/api/account/business-application", {
        method: "POST",
        body: formData,
        credentials: "same-origin"
      });
      let result: BusinessApplicationFormState;
      try {
        result = (await res.json()) as BusinessApplicationFormState;
      } catch {
        result = {
          status: "error",
          message: "Could not read the server response. Please refresh and try again."
        };
      }
      setState(result);
      if (result.status === "success" && result.applicationId) {
        router.refresh();
        router.push(`/account/business-application/${result.applicationId}?submitted=1`);
      }
    } catch {
      setState({
        status: "error",
        message: "Network error while submitting. Please try again."
      });
    } finally {
      setPending(false);
    }
  }

  const notice =
    clientError || state.status === "error"
      ? { status: "error" as const, message: clientError || state.message }
      : state.status === "success"
        ? state
        : null;

  return (
    <form className="admin-form business-application-form" onSubmit={handleSubmit} noValidate>
      {notice ? (
        <div className={notice.status === "success" ? "form-success" : "form-error"} role="status">
          {notice.message}
        </div>
      ) : null}

      {/* 1. Application type */}
      <section className="form-card">
        <div className="form-card-heading">
          <div>
            <h2>Application type</h2>
            <p>Wholesale pricing and tax-exempt status are reviewed and approved separately.</p>
          </div>
          <span className="required-note">* Required</span>
        </div>
        <div className="application-type-choices" role="radiogroup" aria-label="Application type">
          {(
            [
              ["wholesale", "Apply for business account (offline discount orders)"],
              ["tax", "Apply for resale tax-exempt status"],
              ["both", "Apply for business account and resale tax-exempt status"]
            ] as const
          ).map(([value, label]) => (
            <label
              key={value}
              className={
                applicationType === value
                  ? "application-type-option selected"
                  : "application-type-option"
              }
            >
              <input
                type="radio"
                name="applicationTypeUi"
                value={value}
                checked={applicationType === value}
                onChange={() => setApplicationType(value)}
              />
              <span>{label}</span>
            </label>
          ))}
        </div>
      </section>

      {/* 2. Business name + contact */}
      <section className="form-card">
        <div className="form-card-heading">
          <div>
            <h2>Business &amp; contact</h2>
            <p>Business name and the person we can reach about this application.</p>
          </div>
        </div>
        <div className="form-grid two-columns">
          <label className="full-width">
            Legal business name *
            <input
              name="legalBusinessName"
              required
              defaultValue={defaults.companyName}
              maxLength={160}
            />
          </label>
          <label>
            Contact name *
            <input
              name="applicantFullName"
              required
              defaultValue={defaults.fullName}
              autoComplete="name"
              maxLength={120}
            />
          </label>
          <label>
            Email address *
            <input
              name="applicantEmail"
              type="email"
              required
              defaultValue={defaults.email}
              autoComplete="email"
              maxLength={160}
            />
          </label>
          <label>
            Phone number *
            <input
              name="applicantPhone"
              type="tel"
              required
              defaultValue={formatUsPhoneDisplay(defaults.phone) || defaults.phone}
              placeholder="(714) 555-1234"
              inputMode="tel"
              maxLength={20}
              autoComplete="tel"
            />
          </label>
        </div>
      </section>

      {/* 3. Address */}
      <section className="form-card">
        <div className="form-card-heading">
          <div>
            <h2>Business address</h2>
            <p>Primary operating location.</p>
          </div>
        </div>
        <div className="form-grid two-columns">
          <label className="full-width">
            Street address *
            <input name="businessStreet" required maxLength={160} autoComplete="street-address" />
          </label>
          <label className="full-width">
            Address line 2
            <input name="businessAddressLine2" maxLength={160} placeholder="Suite, unit…" />
          </label>
          <label>
            City *
            <input name="businessCity" required maxLength={80} />
          </label>
          <label>
            State *
            <select name="businessState" required defaultValue="CA">
              {US_STATES.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.code} — {s.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            ZIP code *
            <input
              name="businessZip"
              required
              maxLength={10}
              pattern="\d{5}(-\d{4})?"
              inputMode="numeric"
              placeholder="92840"
            />
          </label>
          <label>
            Country *
            <select name="businessCountry" required defaultValue="US">
              <option value="US">United States</option>
            </select>
          </label>
        </div>
      </section>

      {/* 4. Tax / resale license */}
      {taxOn ? (
        <section className="form-card">
          <div className="form-card-heading">
            <div>
              <h2>
                <ShieldCheck size={18} aria-hidden="true" /> Resale / tax-exempt license
              </h2>
              <p>The permit or exemption used for qualifying purchases.</p>
            </div>
          </div>
          <div className="form-grid two-columns">
            <label>
              Exemption type *
              <select
                name="exemptionType"
                required={taxOn}
                value={exemptionType}
                onChange={(e) => setExemptionType(e.target.value)}
              >
                {EXEMPTION_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Issuing state *
              <select name="issuingState" required={taxOn} defaultValue="CA">
                {US_STATES.map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.code} — {s.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Seller’s permit or certificate number {needsPermitNumber ? "*" : ""}
              <input name="permitNumber" required={taxOn && needsPermitNumber} maxLength={80} />
            </label>
            <label>
              Name shown on certificate *
              <input
                name="certificateBusinessName"
                required={taxOn}
                defaultValue={defaults.companyName}
                maxLength={160}
              />
            </label>
          </div>
        </section>
      ) : null}

      {/* 5. Documents */}
      <section className="form-card">
        <div className="form-card-heading">
          <div>
            <h2>
              <FileUp size={18} aria-hidden="true" /> License / supporting documents
            </h2>
            <p>Upload your seller’s permit, resale certificate, or other verifying documents.</p>
          </div>
        </div>
        <label className="upload-drop">
          <input
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
            multiple
            onChange={onPickFiles}
          />
          <strong>Choose files</strong>
          <span>{BUSINESS_DOC_ACCEPTED_LABEL}</span>
        </label>
        {files.length ? (
          <ul className="upload-file-list business-doc-list">
            {files.map((item) => (
              <li key={item.id}>
                <div>
                  <strong>{item.file.name}</strong>
                  <span>{formatBytes(item.file.size)}</span>
                </div>
                <label>
                  <span className="visually-hidden">Document type</span>
                  <select
                    value={item.documentType}
                    onChange={(e) =>
                      setFiles((prev) =>
                        prev.map((f) =>
                          f.id === item.id ? { ...f, documentType: e.target.value } : f
                        )
                      )
                    }
                  >
                    {DOCUMENT_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  className="button secondary compact"
                  onClick={() => removeFile(item.id)}
                  aria-label={`Remove ${item.file.name}`}
                >
                  <Trash2 size={14} /> Remove
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        <p className="field-hint">
          Documents are stored privately and are only visible to authorized staff reviewing your
          application.
        </p>
      </section>

      {/* 6. Signature */}
      <section className="form-card">
        <div className="form-card-heading">
          <div>
            <h2>Certification and electronic signature</h2>
            <p>All certifications are required before you can submit.</p>
          </div>
        </div>
        <div className="cert-check-list">
          <label className="checkbox-label">
            <input type="checkbox" name="certTrue" required />I certify that the information
            provided in this application is true, complete, and accurate.
          </label>
          <label className="checkbox-label">
            <input type="checkbox" name="certAuthorized" required />I certify that I am authorized
            to submit this application on behalf of the business.
          </label>
          <label className="checkbox-label">
            <input type="checkbox" name="certSeparate" required />I understand that wholesale
            pricing and tax-exempt status are reviewed and approved separately.
          </label>
          <label className="checkbox-label">
            <input type="checkbox" name="certEligibleUse" required />I understand that tax-exempt
            purchases may only be used for eligible resale or exempt purposes.
          </label>
          <label className="checkbox-label">
            <input type="checkbox" name="certVerify" required />I authorize the company to verify
            the business, permit, license, and certificate information provided.
          </label>
          {taxOn ? (
            <label className="checkbox-label">
              <input type="checkbox" name="certResale" required={taxOn} />I certify that eligible
              products purchased under this account are intended for resale in the regular course of
              business, unless another valid exemption applies.
            </label>
          ) : null}
        </div>
        <div className="form-grid two-columns" style={{ marginTop: 16 }}>
          <label>
            Authorized signer full name *
            <input
              name="signerName"
              required
              value={signerName}
              onChange={(e) => setSignerName(e.target.value)}
              maxLength={120}
            />
          </label>
          <label>
            Date signed *
            <input name="signedAt" type="date" required defaultValue={todayIso()} max={todayIso()} />
          </label>
          <label className="full-width">
            Electronic signature *
            <input
              name="electronicSignature"
              required
              maxLength={120}
              placeholder="Type your full legal name"
              autoComplete="off"
            />
            <span className="field-hint">
              By typing your full name, you agree that this electronic signature has the same effect
              as a handwritten signature.
            </span>
          </label>
        </div>
      </section>

      <div className="sticky-form-actions">
        <button className="button primary block" type="submit" disabled={pending}>
          {pending ? (
            <>
              <Loader2 size={16} className="spin" aria-hidden="true" /> Submitting application…
            </>
          ) : (
            <>
              <Send size={16} aria-hidden="true" /> Submit application
            </>
          )}
        </button>
        <p className="field-hint" style={{ textAlign: "center", margin: "8px 0 0" }}>
          Default review status: wholesale{" "}
          {wholesaleOn ? WHOLESALE_STATUS_LABELS.pending_review : WHOLESALE_STATUS_LABELS.not_requested}
          {" · "}
          tax exemption{" "}
          {taxOn ? TAX_STATUS_LABELS.pending_review : TAX_STATUS_LABELS.not_requested}
        </p>
      </div>
    </form>
  );
}

export function ApplicationSubmittedBanner({
  applicationNumber,
  submittedAt,
  wholesaleStatus,
  taxStatus,
  applicationId
}: {
  applicationNumber: string;
  submittedAt: string;
  wholesaleStatus: string;
  taxStatus: string;
  applicationId: string;
}) {
  return (
    <div className="legal-callout compact form-success" role="status">
      <h2>Application submitted</h2>
      <p>Thank you. Your application has been received and is pending review.</p>
      <ul className="detail-list compact-list">
        <li>
          <span>Application number</span>
          <strong>{applicationNumber}</strong>
        </li>
        <li>
          <span>Date submitted</span>
          <strong>{submittedAt}</strong>
        </li>
        <li>
          <span>Wholesale status</span>
          <strong>{WHOLESALE_STATUS_LABELS[wholesaleStatus] ?? wholesaleStatus}</strong>
        </li>
        <li>
          <span>Tax exemption status</span>
          <strong>{TAX_STATUS_LABELS[taxStatus] ?? taxStatus}</strong>
        </li>
      </ul>
      <p className="field-hint">A confirmation email has been sent when email delivery is configured.</p>
      <div className="button-row" style={{ marginTop: 12 }}>
        <Link className="button secondary" href="/account">
          Back to account
        </Link>
        <Link className="button primary" href={`/account/business-application/${applicationId}`}>
          View application
        </Link>
      </div>
    </div>
  );
}
