import Link from "next/link";
import { AdminPageHeader } from "@/components/admin-page-header";
import { requireStaffPage } from "@/lib/auth";
import { getApplicationsForStaff } from "@/lib/data/tax-exemption";
import { formatDate } from "@/lib/format";

export const metadata = { title: "Tax exemptions" };

const STATUS_COPY: Record<string, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected"
};

export default async function TaxExemptionsPage() {
  await requireStaffPage();
  const applications = await getApplicationsForStaff();
  const pending = applications.filter((application) => application.status === "pending");

  return (
    <>
      <AdminPageHeader
        eyebrow="Compliance"
        title="Tax exemptions (legacy)"
        description="Legacy single-track tax exemption queue. New dual wholesale + resale applications are under Business apps."
        action={
          <Link className="button primary" href="/admin/business-applications">
            Open business applications
          </Link>
        }
      />

      <div className="filter-chip-row">
        <span>{pending.length} waiting for review</span>
        <span>{applications.length} total</span>
      </div>

      <div className="data-table-card">
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Business</th>
                <th>Contact</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Files</th>
                <th>Submitted</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {applications.map((application) => (
                <tr key={application.id}>
                  <td>{application.businessName}</td>
                  <td>{application.contactName}</td>
                  <td>{application.email}</td>
                  <td>{application.phone}</td>
                  <td className="numeric">{application.documents.length}</td>
                  <td>{formatDate(application.createdAt)}</td>
                  <td>
                    <span className={`status-pill status-${application.status}`}>
                      {STATUS_COPY[application.status] ?? application.status}
                    </span>
                  </td>
                  <td>
                    <Link className="text-link" href={`/admin/tax-exemptions/${application.id}`}>
                      Review
                    </Link>
                  </td>
                </tr>
              ))}
              {!applications.length ? (
                <tr>
                  <td className="empty-table" colSpan={8}>
                    No tax exemption applications yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <div className="legal-callout compact">
        <h2>Wholesale is not the same as tax exempt</h2>
        <p>
          Approving an exemption only changes sales-tax treatment. Wholesale pricing is a separate control on the
          customer record.
        </p>
      </div>
    </>
  );
}
