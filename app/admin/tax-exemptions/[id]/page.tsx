import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { AdminPageHeader } from "@/components/admin-page-header";
import { TaxExemptionReview } from "@/components/tax-exemption-review";
import { getApplicationForStaff } from "@/lib/data/tax-exemption";
import { formatDate } from "@/lib/format";

export default async function TaxExemptionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const application = await getApplicationForStaff(id);
  if (!application) notFound();

  return (
    <>
      <AdminPageHeader
        eyebrow="Compliance"
        title={application.businessName}
        description={`Submitted ${formatDate(application.createdAt)} · status ${application.status}`}
        action={
          <Link className="button secondary" href="/admin/tax-exemptions">
            <ChevronLeft size={17} /> Back to applications
          </Link>
        }
      />

      <section className="form-card">
        <div className="form-card-heading">
          <div>
            <h2>Applicant</h2>
            <p>Details supplied by the customer.</p>
          </div>
        </div>
        <dl className="detail-list">
          <div>
            <dt>Contact name</dt>
            <dd>{application.contactName}</dd>
          </div>
          <div>
            <dt>Business name</dt>
            <dd>{application.businessName}</dd>
          </div>
          <div>
            <dt>Email</dt>
            <dd>
              <a className="text-link" href={`mailto:${application.email}`}>
                {application.email}
              </a>
            </dd>
          </div>
          <div>
            <dt>Phone</dt>
            <dd>{application.phone}</dd>
          </div>
        </dl>
      </section>

      <TaxExemptionReview application={application} />
    </>
  );
}
