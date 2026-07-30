import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminPageHeader } from "@/components/admin-page-header";
import { BusinessApplicationReviewPanel } from "@/components/business-application-review";
import { requireStaffPage } from "@/lib/auth";
import {
  TAX_STATUS_LABELS,
  WHOLESALE_STATUS_LABELS
} from "@/lib/business-application/constants";
import { getBusinessApplicationForStaff } from "@/lib/data/business-applications";
import { formatDate, formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Review business application" };

export default async function AdminBusinessApplicationDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  await requireStaffPage();
  const { id } = await params;
  const app = await getBusinessApplicationForStaff(id);
  if (!app) notFound();

  return (
    <div className="admin-page">
      <AdminPageHeader
        eyebrow="Compliance"
        title={app.applicationNumber}
        description={`${app.legalBusinessName} · submitted ${formatDateTime(app.submittedAt)}`}
        action={
          <Link className="button secondary" href="/admin/business-applications">
            Back to list
          </Link>
        }
      />

      <div className="status-row" style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
        <span className={`status-pill status-${app.wholesaleStatus.replaceAll("_", "-")}`}>
          Wholesale: {WHOLESALE_STATUS_LABELS[app.wholesaleStatus]}
        </span>
        <span className={`status-pill status-${app.taxExemptionStatus.replaceAll("_", "-")}`}>
          Tax: {TAX_STATUS_LABELS[app.taxExemptionStatus]}
        </span>
      </div>

      <section className="form-card">
        <div className="form-card-heading">
          <div>
            <h2>Applicant information</h2>
          </div>
        </div>
        <dl className="detail-list">
          <div>
            <dt>Name / title</dt>
            <dd>
              {app.applicantFullName} · {app.applicantJobTitle}
            </dd>
          </div>
          <div>
            <dt>Contact</dt>
            <dd>
              {app.applicantEmail} · {app.applicantPhone}
              {app.preferredContactMethod ? ` · prefers ${app.preferredContactMethod}` : ""}
            </dd>
          </div>
        </dl>
      </section>

      <section className="form-card">
        <div className="form-card-heading">
          <div>
            <h2>Business information</h2>
          </div>
        </div>
        <dl className="detail-list">
          <div>
            <dt>Legal / DBA</dt>
            <dd>
              {app.legalBusinessName}
              {app.dbaName ? ` · DBA ${app.dbaName}` : ""}
            </dd>
          </div>
          <div>
            <dt>Entity / category</dt>
            <dd>
              {app.entityType} · {app.businessCategory}
            </dd>
          </div>
          <div>
            <dt>Description</dt>
            <dd>{app.businessDescription}</dd>
          </div>
          <div>
            <dt>Website / social</dt>
            <dd>
              {app.websiteUrl || "—"} · {app.socialMediaUrl || "—"}
            </dd>
          </div>
          <div>
            <dt>Volume / years</dt>
            <dd>
              {app.estimatedMonthlyVolume || "—"} · {app.yearsInBusiness ?? "—"} years
            </dd>
          </div>
          <div>
            <dt>Business address</dt>
            <dd>
              {app.businessStreet}
              {app.businessAddressLine2 ? `, ${app.businessAddressLine2}` : ""}
              <br />
              {app.businessCity}, {app.businessState} {app.businessZip}, {app.businessCountry}
            </dd>
          </div>
        </dl>
      </section>

      {app.wholesaleRequested ? (
        <section className="form-card">
          <div className="form-card-heading">
            <div>
              <h2>Wholesale information</h2>
            </div>
          </div>
          <dl className="detail-list">
            <div>
              <dt>Products</dt>
              <dd>{app.productsInterested.join(", ") || "—"}</dd>
            </div>
            <div>
              <dt>Intended use</dt>
              <dd>{app.intendedUse || "—"}</dd>
            </div>
            <div>
              <dt>Channels</dt>
              <dd>{app.salesChannels.join(", ") || "—"}</dd>
            </div>
            <div>
              <dt>First order est.</dt>
              <dd>
                {app.expectedFirstOrderAmount != null
                  ? `$${app.expectedFirstOrderAmount.toFixed(2)}`
                  : "—"}
              </dd>
            </div>
            <div>
              <dt>Notes</dt>
              <dd>{app.wholesaleNotes || "—"}</dd>
            </div>
          </dl>
        </section>
      ) : null}

      {app.taxExemptionRequested ? (
        <section className="form-card">
          <div className="form-card-heading">
            <div>
              <h2>Tax exemption / resale</h2>
            </div>
          </div>
          <dl className="detail-list">
            <div>
              <dt>Type / state</dt>
              <dd>
                {app.exemptionType} · {app.issuingState}
              </dd>
            </div>
            <div>
              <dt>Permit number</dt>
              <dd>{app.permitNumber || "—"}</dd>
            </div>
            <div>
              <dt>Dates</dt>
              <dd>
                Effective {app.certificateEffectiveDate ? formatDate(app.certificateEffectiveDate) : "—"} ·
                Expires{" "}
                {app.certificateExpirationDate
                  ? formatDate(app.certificateExpirationDate)
                  : "—"}
              </dd>
            </div>
            <div>
              <dt>Name on certificate</dt>
              <dd>{app.certificateBusinessName || "—"}</dd>
            </div>
            <div>
              <dt>Resale description</dt>
              <dd>{app.resaleProductDescription || "—"}</dd>
            </div>
            <div>
              <dt>Verification ref</dt>
              <dd>{app.verificationReference || "—"}</dd>
            </div>
          </dl>
        </section>
      ) : null}

      <section className="form-card">
        <div className="form-card-heading">
          <div>
            <h2>Signature &amp; audit</h2>
          </div>
        </div>
        <dl className="detail-list">
          <div>
            <dt>Signer</dt>
            <dd>
              {app.signerName} · {app.signerTitle}
            </dd>
          </div>
          <div>
            <dt>E-signature</dt>
            <dd>{app.electronicSignature}</dd>
          </div>
          <div>
            <dt>Signed / submitted</dt>
            <dd>
              {formatDateTime(app.signedAt)} · {formatDateTime(app.submittedAt)}
            </dd>
          </div>
          <div>
            <dt>IP / user agent</dt>
            <dd>
              {app.ipAddress || "—"}
              <br />
              <small>{app.userAgent || "—"}</small>
            </dd>
          </div>
        </dl>
      </section>

      <BusinessApplicationReviewPanel application={app} />

      {app.reviews?.length ? (
        <section className="form-card">
          <div className="form-card-heading">
            <div>
              <h2>Review history</h2>
            </div>
          </div>
          <ul className="upload-file-list">
            {app.reviews.map((r) => (
              <li key={r.id}>
                <div>
                  <strong>
                    {r.reviewType} · {r.decision || r.newStatus}
                  </strong>
                  <span>
                    {formatDateTime(r.createdAt)}
                    {r.reason ? ` · ${r.reason}` : ""}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {app.auditLogs?.length ? (
        <section className="form-card">
          <div className="form-card-heading">
            <div>
              <h2>Audit log</h2>
            </div>
          </div>
          <ul className="upload-file-list">
            {app.auditLogs.map((a) => (
              <li key={a.id}>
                <div>
                  <strong>
                    {a.action} · {a.actorType}
                  </strong>
                  <span>{formatDateTime(a.createdAt)}</span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
