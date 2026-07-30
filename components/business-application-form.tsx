"use client";

import { useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, FileUp, Loader2, Send, ShieldCheck, Trash2 } from "lucide-react";
import {
  BUSINESS_CATEGORIES,
  BUSINESS_DOC_ACCEPTED_LABEL,
  CONTACT_METHODS,
  DOCUMENT_TYPES,
  ENTITY_TYPES,
  EXEMPTION_TYPES,
  INTENDED_USES,
  JOB_TITLES,
  MAX_BUSINESS_DOC_BYTES,
  MAX_BUSINESS_DOCS,
  MONTHLY_VOLUMES,
  SALES_CHANNELS,
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

type ProductCategoryOption = { id: string; name: string };

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

export function BusinessApplicationForm({
  defaults,
  productCategories
}: {
  defaults: Defaults;
  productCategories: ProductCategoryOption[];
}) {
  const router = useRouter();
  const [applicationType, setApplicationType] = useState<ApplicationTypeChoice>("both");
  const wholesaleOn = applicationType === "wholesale" || applicationType === "both";
  const taxOn = applicationType === "tax" || applicationType === "both";

  const [jobTitle, setJobTitle] = useState("Owner");
  const [mailingSame, setMailingSame] = useState(true);
  const [shippingSame, setShippingSame] = useState(true);
  const [certSame, setCertSame] = useState(true);
  const [exemptionType, setExemptionType] = useState<string>(EXEMPTION_TYPES[0]);
  const [files, setFiles] = useState<PendingFile[]>([]);
  const [pending, setPending] = useState(false);
  const [state, setState] = useState<BusinessApplicationFormState>(
    initialBusinessApplicationFormState
  );
  const [clientError, setClientError] = useState("");
  const [signerName, setSignerName] = useState(defaults.fullName);
  const [productsSelected, setProductsSelected] = useState<string[]>([]);

  const categoryOptions = useMemo(() => {
    if (productCategories.length) return productCategories.map((c) => c.name);
    return [
      "Pantry staples",
      "Frozen foods",
      "Snacks",
      "Sauces & condiments",
      "Beverages",
      "Other"
    ];
  }, [productCategories]);

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

  function toggleProduct(name: string) {
    setProductsSelected((prev) =>
      prev.includes(name) ? prev.filter((p) => p !== name) : [...prev, name]
    );
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
    if (wholesaleOn && productsSelected.length === 0) {
      setClientError("Select at least one product category for wholesale.");
      return;
    }

    const form = event.currentTarget;
    const formData = new FormData(form);
    formData.set("applicationType", applicationType);
    formData.set("mailingSameAsBusiness", mailingSame ? "true" : "false");
    formData.set("shippingSameAsBusiness", shippingSame ? "true" : "false");
    formData.set("certificateSameAsBusiness", certSame ? "true" : "false");

    // Files + types
    formData.delete("documents");
    files.forEach((item, index) => {
      formData.append("documents", item.file);
      formData.set(`documentType_${index}`, item.documentType);
    });

    // Multi products
    formData.delete("productsInterested");
    for (const p of productsSelected) formData.append("productsInterested", p);

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

      {/* 2. Applicant */}
      <section className="form-card">
        <div className="form-card-heading">
          <div>
            <h2>Applicant information</h2>
            <p>
              Enter the information of the person authorized to submit this application on behalf of
              the business.
            </p>
          </div>
        </div>
        <div className="form-grid two-columns">
          <label>
            Full legal name *
            <input
              name="applicantFullName"
              required
              defaultValue={defaults.fullName}
              autoComplete="name"
              maxLength={120}
            />
          </label>
          <label>
            Job title *
            <select
              name="applicantJobTitle"
              required
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
            >
              {JOB_TITLES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          {jobTitle === "Other" ? (
            <label className="full-width">
              Job title (other) *
              <input name="applicantJobTitleOther" required maxLength={80} placeholder="Your title" />
            </label>
          ) : null}
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
          <label>
            Preferred contact method
            <select name="preferredContactMethod" defaultValue="Email">
              <option value="">Select…</option>
              {CONTACT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      {/* 3. Business */}
      <section className="form-card">
        <div className="form-card-heading">
          <div>
            <h2>
              <Building2 size={18} aria-hidden="true" /> Business information
            </h2>
            <p>Provide the legal and operating details of your business.</p>
          </div>
        </div>
        <div className="form-grid two-columns">
          <label>
            Legal business name *
            <input
              name="legalBusinessName"
              required
              defaultValue={defaults.companyName}
              maxLength={160}
            />
          </label>
          <label>
            DBA or store name
            <input name="dbaName" maxLength={160} placeholder="Doing Business As, if different" />
            <span className="field-hint">Doing Business As, if different from the legal business name.</span>
          </label>
          <label>
            Business entity type *
            <select name="entityType" required defaultValue={ENTITY_TYPES[1]}>
              {ENTITY_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label>
            Business category *
            <select name="businessCategory" required defaultValue={BUSINESS_CATEGORIES[0]}>
              {BUSINESS_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="full-width">
            Business description *
            <textarea
              name="businessDescription"
              required
              rows={3}
              maxLength={2000}
              placeholder="Describe what your business sells or the services it provides."
            />
          </label>
          <label>
            Business website
            <input name="websiteUrl" type="url" placeholder="https://" maxLength={400} />
          </label>
          <label>
            Social media URL
            <input
              name="socialMediaUrl"
              type="url"
              placeholder="Instagram, Facebook, TikTok…"
              maxLength={400}
            />
          </label>
          <label>
            Years in business
            <input name="yearsInBusiness" type="number" min={0} max={200} inputMode="numeric" />
          </label>
          <label>
            Estimated monthly purchasing volume
            <select name="estimatedMonthlyVolume" defaultValue="">
              <option value="">Select…</option>
              {MONTHLY_VOLUMES.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      {/* 4. Address */}
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

        <div className="checkbox-row" style={{ marginTop: 14 }}>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={mailingSame}
              onChange={(e) => setMailingSame(e.target.checked)}
            />
            Mailing address is the same as business address
          </label>
        </div>
        {!mailingSame ? (
          <div className="form-grid two-columns" style={{ marginTop: 12 }}>
            <p className="full-width field-hint">
              <strong>Mailing address</strong>
            </p>
            <label className="full-width">
              Street address *
              <input name="mailingStreet" required={!mailingSame} maxLength={160} />
            </label>
            <label className="full-width">
              Address line 2
              <input name="mailingLine2" maxLength={160} />
            </label>
            <label>
              City *
              <input name="mailingCity" required={!mailingSame} maxLength={80} />
            </label>
            <label>
              State *
              <select name="mailingState" required={!mailingSame} defaultValue="CA">
                {US_STATES.map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.code}
                  </option>
                ))}
              </select>
            </label>
            <label>
              ZIP *
              <input name="mailingZip" required={!mailingSame} maxLength={10} />
            </label>
            <label>
              Country *
              <select name="mailingCountry" defaultValue="US">
                <option value="US">United States</option>
              </select>
            </label>
          </div>
        ) : null}

        <div className="checkbox-row" style={{ marginTop: 14 }}>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={shippingSame}
              onChange={(e) => setShippingSame(e.target.checked)}
            />
            Shipping address is the same as business address
          </label>
        </div>
        {!shippingSame ? (
          <div className="form-grid two-columns" style={{ marginTop: 12 }}>
            <p className="full-width field-hint">
              <strong>Shipping address</strong>
            </p>
            <label className="full-width">
              Street address *
              <input name="shippingStreet" required={!shippingSame} maxLength={160} />
            </label>
            <label className="full-width">
              Address line 2
              <input name="shippingLine2" maxLength={160} />
            </label>
            <label>
              City *
              <input name="shippingCity" required={!shippingSame} maxLength={80} />
            </label>
            <label>
              State *
              <select name="shippingState" required={!shippingSame} defaultValue="CA">
                {US_STATES.map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.code}
                  </option>
                ))}
              </select>
            </label>
            <label>
              ZIP *
              <input name="shippingZip" required={!shippingSame} maxLength={10} />
            </label>
            <label>
              Country *
              <select name="shippingCountry" defaultValue="US">
                <option value="US">United States</option>
              </select>
            </label>
          </div>
        ) : null}
      </section>

      {/* 5. Wholesale */}
      {wholesaleOn ? (
        <section className="form-card">
          <div className="form-card-heading">
            <div>
              <h2>Wholesale account information</h2>
              <p>Tell us what products you plan to purchase and resell.</p>
            </div>
          </div>
          <fieldset className="checkbox-fieldset">
            <legend>Products interested in purchasing *</legend>
            <div className="chip-check-grid">
              {categoryOptions.map((name) => (
                <label key={name} className="chip-check">
                  <input
                    type="checkbox"
                    checked={productsSelected.includes(name)}
                    onChange={() => toggleProduct(name)}
                  />
                  <span>{name}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="form-grid two-columns" style={{ marginTop: 16 }}>
            <label>
              Intended use *
              <select name="intendedUse" required={wholesaleOn} defaultValue={INTENDED_USES[0]}>
                {INTENDED_USES.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Expected first order amount (USD)
              <input
                name="expectedFirstOrderAmount"
                type="number"
                min={0}
                step="0.01"
                inputMode="decimal"
                placeholder="0.00"
              />
            </label>
            <fieldset className="full-width checkbox-fieldset">
              <legend>Sales channels</legend>
              <div className="chip-check-grid">
                {SALES_CHANNELS.map((ch) => (
                  <label key={ch} className="chip-check">
                    <input type="checkbox" name="salesChannels" value={ch} />
                    <span>{ch}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="full-width">
              Notes for wholesale review
              <textarea name="wholesaleNotes" rows={3} maxLength={2000} />
            </label>
          </div>
        </section>
      ) : null}

      {/* 6. Tax / resale */}
      {taxOn ? (
        <section className="form-card">
          <div className="form-card-heading">
            <div>
              <h2>
                <ShieldCheck size={18} aria-hidden="true" /> Resale and tax-exempt information
              </h2>
              <p>Provide the permit or exemption information used for qualifying purchases.</p>
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
              Certificate effective date
              <input name="certificateEffectiveDate" type="date" />
            </label>
            <label>
              Certificate expiration date
              <input name="certificateExpirationDate" type="date" />
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
            <div className="full-width checkbox-row">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={certSame}
                  onChange={(e) => setCertSame(e.target.checked)}
                />
                Address shown on certificate is the same as business address
              </label>
            </div>
            {!certSame ? (
              <>
                <label className="full-width">
                  Certificate street address *
                  <input name="certificateStreet" required={!certSame} maxLength={160} />
                </label>
                <label className="full-width">
                  Address line 2
                  <input name="certificateLine2" maxLength={160} />
                </label>
                <label>
                  City *
                  <input name="certificateCity" required={!certSame} maxLength={80} />
                </label>
                <label>
                  State *
                  <select name="certificateState" required={!certSame} defaultValue="CA">
                    {US_STATES.map((s) => (
                      <option key={s.code} value={s.code}>
                        {s.code}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  ZIP *
                  <input name="certificateZip" required={!certSame} maxLength={10} />
                </label>
                <label>
                  Country *
                  <select name="certificateCountry" defaultValue="US">
                    <option value="US">United States</option>
                  </select>
                </label>
              </>
            ) : null}
            <label className="full-width">
              Description of products being purchased for resale *
              <textarea
                name="resaleProductDescription"
                required={taxOn}
                rows={3}
                maxLength={2000}
                placeholder="Describe the products you are purchasing for resale."
              />
            </label>
            {!needsPermitNumber ? (
              <label className="full-width">
                Reason no seller’s permit number is required *
                <textarea name="noPermitReason" required={taxOn && !needsPermitNumber} rows={2} />
              </label>
            ) : null}
            <label className="full-width">
              State verification URL or verification reference
              <input name="verificationReference" maxLength={400} />
            </label>
          </div>
        </section>
      ) : null}

      {/* 7. Documents */}
      <section className="form-card">
        <div className="form-card-heading">
          <div>
            <h2>
              <FileUp size={18} aria-hidden="true" /> Supporting documents
            </h2>
            <p>Upload the documents required to verify your wholesale or tax-exempt application.</p>
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

      {/* 8. Signature */}
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
            Authorized signer title *
            <input name="signerTitle" required defaultValue={jobTitle === "Other" ? "" : jobTitle} maxLength={80} />
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
          <label>
            Date signed *
            <input name="signedAt" type="date" required defaultValue={todayIso()} max={todayIso()} />
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
