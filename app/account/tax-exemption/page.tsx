import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, FileText } from "lucide-react";
import { TaxExemptionForm } from "@/components/tax-exemption-form";
import { getViewer } from "@/lib/auth";
import { getOwnApplications, getOwnCustomer } from "@/lib/data/tax-exemption";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Tax exemption application" };

const STATUS_COPY: Record<string, string> = {
  pending: "Waiting for review",
  approved: "Approved",
  rejected: "Rejected"
};

export default async function TaxExemptionPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login?next=/account/tax-exemption&message=Sign%20in%20to%20apply.");

  const [customer, applications] = await Promise.all([getOwnCustomer(viewer.id), getOwnApplications(viewer.id)]);
  const pending = applications.find((application) => application.status === "pending");

  return (
    <div className="page-shell shell narrow-page">
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <Link href="/account">
          <ChevronLeft size={14} /> Account
        </Link>
      </nav>
      <header className="page-heading">
        <span className="kicker">Business customers</span>
        <h1>Tax exemption application</h1>
        <p>
          Send your exemption certificate for review. Wholesale pricing and tax-exempt status are separate —
          approval here only affects sales tax.
        </p>
      </header>

      {applications.length ? (
        <section className="form-card">
          <div className="form-card-heading">
            <div>
              <h2>Your applications</h2>
              <p>Most recent first.</p>
            </div>
          </div>
          <ul className="cart-items">
            {applications.map((application) => (
              <li className="application-row" key={application.id}>
                <FileText size={18} aria-hidden="true" />
                <div>
                  <strong>{application.businessName}</strong>
                  <span>
                    Submitted {formatDate(application.createdAt)} · {application.documents.length} document
                    {application.documents.length === 1 ? "" : "s"}
                  </span>
                  {application.reviewNote ? <span>Reviewer note: {application.reviewNote}</span> : null}
                </div>
                <span className={`status-pill status-${application.status}`}>
                  {STATUS_COPY[application.status] ?? application.status}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {pending ? (
        <div className="legal-callout compact">
          <h2>Application received</h2>
          <p>
            We are reviewing the documents you sent on {formatDate(pending.createdAt)}. You can submit a new
            application once this one has been reviewed.
          </p>
        </div>
      ) : (
        <TaxExemptionForm
          defaults={{
            contactName: [customer?.first_name, customer?.last_name].filter(Boolean).join(" ") || viewer.fullName,
            businessName: customer?.company_name ?? "",
            email: customer?.email ?? viewer.email,
            phone: customer?.phone ?? ""
          }}
        />
      )}
    </div>
  );
}
