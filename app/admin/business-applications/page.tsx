import type { Metadata } from "next";
import Link from "next/link";
import { AdminPageHeader } from "@/components/admin-page-header";
import { requireStaffPage } from "@/lib/auth";
import {
  TAX_STATUS_LABELS,
  WHOLESALE_STATUS_LABELS
} from "@/lib/business-application/constants";
import { maskPermitNumber } from "@/lib/business-application/validate";
import { listBusinessApplicationsForStaff } from "@/lib/data/business-applications";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Business applications" };

export default async function AdminBusinessApplicationsPage({
  searchParams
}: {
  searchParams: Promise<{ q?: string; wholesale?: string; tax?: string }>;
}) {
  await requireStaffPage();
  const sp = await searchParams;
  const applications = await listBusinessApplicationsForStaff({
    q: sp.q,
    wholesaleStatus: sp.wholesale,
    taxStatus: sp.tax
  });

  return (
    <div className="admin-page">
      <AdminPageHeader
        eyebrow="Compliance"
        title="Business applications"
        description="Wholesale pricing and resale tax exemption — reviewed as separate tracks."
      />

      <form className="inventory-table-toolbar" method="get">
        <label className="search-field">
          <span className="visually-hidden">Search</span>
          <input
            name="q"
            defaultValue={sp.q ?? ""}
            placeholder="Application #, business, email, phone, permit…"
          />
        </label>
        <label>
          <span className="visually-hidden">Wholesale status</span>
          <select name="wholesale" defaultValue={sp.wholesale ?? "all"}>
            <option value="all">All wholesale</option>
            {Object.entries(WHOLESALE_STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="visually-hidden">Tax status</span>
          <select name="tax" defaultValue={sp.tax ?? "all"}>
            <option value="all">All tax exemption</option>
            {Object.entries(TAX_STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <button className="button secondary compact" type="submit">
          Filter
        </button>
      </form>

      <div className="data-table-card">
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Application</th>
                <th>Applicant / business</th>
                <th>Type</th>
                <th>State / permit</th>
                <th>Wholesale</th>
                <th>Tax exemption</th>
                <th>Submitted</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {applications.length === 0 ? (
                <tr>
                  <td colSpan={8}>
                    <p className="field-hint" style={{ padding: 16 }}>
                      No applications match these filters.
                    </p>
                  </td>
                </tr>
              ) : (
                applications.map((app) => {
                  const type =
                    app.wholesaleRequested && app.taxExemptionRequested
                      ? "Both"
                      : app.wholesaleRequested
                        ? "Wholesale"
                        : "Tax exemption";
                  return (
                    <tr key={app.id}>
                      <td>
                        <strong>{app.applicationNumber}</strong>
                        {app.riskFlag ? (
                          <span className="status-pill status-rejected">{app.riskFlag}</span>
                        ) : null}
                      </td>
                      <td>
                        <div>{app.applicantFullName}</div>
                        <small>
                          {app.legalBusinessName}
                          {app.dbaName ? ` · ${app.dbaName}` : ""}
                        </small>
                        <small>
                          {app.applicantEmail} · {app.applicantPhone}
                        </small>
                      </td>
                      <td>{type}</td>
                      <td>
                        {app.issuingState || "—"}
                        <br />
                        <small>{maskPermitNumber(app.permitNumber)}</small>
                      </td>
                      <td>
                        <span
                          className={`status-pill status-${app.wholesaleStatus.replaceAll("_", "-")}`}
                        >
                          {WHOLESALE_STATUS_LABELS[app.wholesaleStatus]}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`status-pill status-${app.taxExemptionStatus.replaceAll("_", "-")}`}
                        >
                          {TAX_STATUS_LABELS[app.taxExemptionStatus]}
                        </span>
                      </td>
                      <td>{formatDateTime(app.submittedAt)}</td>
                      <td>
                        <Link
                          className="button secondary compact"
                          href={`/admin/business-applications/${app.id}`}
                        >
                          Review
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
