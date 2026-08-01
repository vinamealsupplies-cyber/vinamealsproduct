import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, FileText } from "lucide-react";
import { BusinessApplicationForm } from "@/components/business-application-form";
import { getViewer } from "@/lib/auth";
import {
  TAX_STATUS_LABELS,
  WHOLESALE_STATUS_LABELS
} from "@/lib/business-application/constants";
import {
  getOwnCustomerForBusinessApp,
  listOwnBusinessApplications
} from "@/lib/data/business-applications";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = {
  title: "Wholesale & Resale Account Application"
};

export default async function BusinessApplicationPage() {
  const viewer = await getViewer();
  if (!viewer) {
    redirect("/login?next=/account/business-application&message=Sign%20in%20to%20apply.");
  }

  const [customer, applications] = await Promise.all([
    getOwnCustomerForBusinessApp(viewer.id),
    listOwnBusinessApplications(viewer.id)
  ]);

  const openApp = applications.find(
    (a) =>
      a.wholesaleStatus === "pending_review" ||
      a.wholesaleStatus === "under_review" ||
      a.taxExemptionStatus === "pending_review" ||
      a.taxExemptionStatus === "under_review" ||
      a.taxExemptionStatus === "more_info_required"
  );

  return (
    <div className="page-shell shell narrow-page">
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <Link href="/account">
          <ChevronLeft size={14} /> Account
        </Link>
      </nav>
      <header className="page-heading">
        <span className="kicker">Business customers</span>
        <h1>Wholesale &amp; Resale Account Application</h1>
        <p>
          Apply for wholesale pricing, resale tax-exempt status, or both. Wholesale approval and
          tax-exempt approval are reviewed separately.
        </p>
      </header>

      {applications.length ? (
        <section className="form-card">
          <div className="form-card-heading">
            <div>
              <h2>Your applications</h2>
              <p>Most recent first. Open an application to view documents and messages.</p>
            </div>
          </div>
          <ul className="cart-items">
            {applications.map((application) => (
              <li className="application-row" key={application.id}>
                <FileText size={18} aria-hidden="true" />
                <div>
                  <strong>
                    {application.applicationNumber} · {application.legalBusinessName}
                  </strong>
                  <span>
                    Submitted {formatDate(application.submittedAt)} ·{" "}
                    {application.documents.length} document
                    {application.documents.length === 1 ? "" : "s"}
                  </span>
                  <span>
                    Wholesale: {WHOLESALE_STATUS_LABELS[application.wholesaleStatus]} · Tax:{" "}
                    {TAX_STATUS_LABELS[application.taxExemptionStatus]}
                  </span>
                </div>
                <Link
                  className="button secondary compact"
                  href={`/account/business-application/${application.id}`}
                >
                  View
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {openApp ? (
        <div className="legal-callout compact">
          <h2>Application in review</h2>
          <p>
            Application <strong>{openApp.applicationNumber}</strong> is still open. You can view it
            and upload additional documents if we request more information. Submit a new application
            after this one is fully decided.
          </p>
          <Link
            className="button primary"
            href={`/account/business-application/${openApp.id}`}
            style={{ marginTop: 12 }}
          >
            Open application
          </Link>
        </div>
      ) : (
        <BusinessApplicationForm
          defaults={{
            fullName:
              [customer?.first_name, customer?.last_name].filter(Boolean).join(" ") ||
              viewer.fullName ||
              "",
            email: customer?.email ?? viewer.email,
            phone: customer?.phone ?? "",
            companyName: customer?.company_name ?? ""
          }}
        />
      )}
    </div>
  );
}
