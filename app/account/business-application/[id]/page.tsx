import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { ApplicationSubmittedBanner } from "@/components/business-application-form";
import { AdditionalDocumentsForm } from "@/components/business-application-extra-docs";
import { getViewer } from "@/lib/auth";
import {
  TAX_STATUS_LABELS,
  WHOLESALE_STATUS_LABELS
} from "@/lib/business-application/constants";
import { getOwnBusinessApplication } from "@/lib/data/business-applications";
import { formatDate, formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Business application status" };

export default async function BusinessApplicationDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ submitted?: string }>;
}) {
  const viewer = await getViewer();
  if (!viewer) redirect("/login?next=/account/business-application");

  const { id } = await params;
  const sp = await searchParams;
  const app = await getOwnBusinessApplication(viewer.id, id);
  if (!app) notFound();

  const needsDocs = app.taxExemptionStatus === "more_info_required";
  const canUpload =
    needsDocs ||
    app.wholesaleStatus === "pending_review" ||
    app.wholesaleStatus === "under_review" ||
    app.taxExemptionStatus === "pending_review" ||
    app.taxExemptionStatus === "under_review";

  return (
    <div className="page-shell shell narrow-page">
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <Link href="/account/business-application">
          <ChevronLeft size={14} /> Applications
        </Link>
      </nav>

      {sp.submitted === "1" ? (
        <ApplicationSubmittedBanner
          applicationNumber={app.applicationNumber}
          submittedAt={formatDateTime(app.submittedAt)}
          wholesaleStatus={app.wholesaleStatus}
          taxStatus={app.taxExemptionStatus}
          applicationId={app.id}
        />
      ) : null}

      <header className="page-heading">
        <span className="kicker">Business &amp; tax exemption</span>
        <h1>{app.applicationNumber}</h1>
        <p>
          {app.legalBusinessName}
          {app.dbaName ? ` · DBA ${app.dbaName}` : ""}
        </p>
      </header>

      <section className="form-card">
        <div className="form-card-heading">
          <div>
            <h2>Status</h2>
            <p>Submitted {formatDateTime(app.submittedAt)}</p>
          </div>
        </div>
        <dl className="detail-list">
          <div>
            <dt>Wholesale</dt>
            <dd>
              <span className={`status-pill status-${app.wholesaleStatus.replaceAll("_", "-")}`}>
                {WHOLESALE_STATUS_LABELS[app.wholesaleStatus]}
              </span>
              {!app.wholesaleRequested ? " (not requested)" : null}
            </dd>
          </div>
          <div>
            <dt>Tax exemption</dt>
            <dd>
              <span
                className={`status-pill status-${app.taxExemptionStatus.replaceAll("_", "-")}`}
              >
                {TAX_STATUS_LABELS[app.taxExemptionStatus]}
              </span>
              {!app.taxExemptionRequested ? " (not requested)" : null}
            </dd>
          </div>
          {app.certificateExpirationDate ? (
            <div>
              <dt>Certificate expiration</dt>
              <dd>{formatDate(app.certificateExpirationDate)}</dd>
            </div>
          ) : null}
          {app.customerVisibleMessage ? (
            <div>
              <dt>Message from review team</dt>
              <dd>{app.customerVisibleMessage}</dd>
            </div>
          ) : null}
          {app.wholesaleDecisionReason && app.wholesaleStatus === "rejected" ? (
            <div>
              <dt>Wholesale note</dt>
              <dd>{app.wholesaleDecisionReason}</dd>
            </div>
          ) : null}
          {app.taxDecisionReason &&
          (app.taxExemptionStatus === "rejected" ||
            app.taxExemptionStatus === "more_info_required") ? (
            <div>
              <dt>Tax exemption note</dt>
              <dd>{app.taxDecisionReason}</dd>
            </div>
          ) : null}
        </dl>
      </section>

      <section className="form-card">
        <div className="form-card-heading">
          <div>
            <h2>Applicant &amp; business</h2>
          </div>
        </div>
        <dl className="detail-list">
          <div>
            <dt>Applicant</dt>
            <dd>
              {app.applicantFullName} · {app.applicantJobTitle}
            </dd>
          </div>
          <div>
            <dt>Contact</dt>
            <dd>
              {app.applicantEmail} · {app.applicantPhone}
            </dd>
          </div>
          <div>
            <dt>Legal name</dt>
            <dd>{app.legalBusinessName}</dd>
          </div>
          <div>
            <dt>Entity / category</dt>
            <dd>
              {app.entityType} · {app.businessCategory}
            </dd>
          </div>
          <div>
            <dt>Business address</dt>
            <dd>
              {app.businessStreet}
              {app.businessAddressLine2 ? `, ${app.businessAddressLine2}` : ""}, {app.businessCity},{" "}
              {app.businessState} {app.businessZip}
            </dd>
          </div>
        </dl>
      </section>

      {app.taxExemptionRequested ? (
        <section className="form-card">
          <div className="form-card-heading">
            <div>
              <h2>Resale / tax details</h2>
            </div>
          </div>
          <dl className="detail-list">
            <div>
              <dt>Exemption type</dt>
              <dd>{app.exemptionType}</dd>
            </div>
            <div>
              <dt>Issuing state</dt>
              <dd>{app.issuingState}</dd>
            </div>
            <div>
              <dt>Permit / certificate #</dt>
              <dd>{app.permitNumber || "—"}</dd>
            </div>
            <div>
              <dt>Name on certificate</dt>
              <dd>{app.certificateBusinessName}</dd>
            </div>
          </dl>
        </section>
      ) : null}

      <section className="form-card">
        <div className="form-card-heading">
          <div>
            <h2>Documents</h2>
            <p>{app.documents.length} file(s) on file</p>
          </div>
        </div>
        {app.documents.length ? (
          <ul className="upload-file-list">
            {app.documents.map((doc) => (
              <li key={doc.id}>
                <div>
                  <strong>{doc.originalFilename || "Document"}</strong>
                  <span>
                    {doc.documentType} · {formatDateTime(doc.uploadedAt)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="field-hint">No documents listed.</p>
        )}
        {canUpload ? <AdditionalDocumentsForm applicationId={app.id} highlight={needsDocs} /> : null}
      </section>

      <div className="button-row">
        <Link className="button secondary" href="/account">
          Back to account
        </Link>
        <Link className="button secondary" href="/account/business-application">
          All applications
        </Link>
      </div>
    </div>
  );
}
