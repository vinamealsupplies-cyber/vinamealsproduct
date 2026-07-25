import Link from "next/link";
import { Building2, FileText, ShieldCheck, UserRound } from "lucide-react";
import { getViewer } from "@/lib/auth";
import { getOwnCustomer } from "@/lib/data/tax-exemption";
import { SetupNotice } from "@/components/setup-notice";

const TAX_STATUS_COPY: Record<string, string> = {
  not_requested: "Not requested",
  pending: "Waiting for review",
  approved: "Approved",
  rejected: "Rejected",
  expired: "Expired"
};

export default async function AccountPage() {
  const viewer = await getViewer();
  if (!viewer) {
    return <div className="page-shell shell narrow-page"><div className="empty-state large"><UserRound size={36} /><h1>Sign in to view your account</h1><p>Access your profile, business status, invoices, and order history.</p><Link className="button primary" href="/login?next=/account">Sign in</Link></div></div>;
  }

  const customer = await getOwnCustomer(viewer.id);
  const taxStatus = customer?.tax_exempt_status ?? "not_requested";

  return (
    <div className="page-shell shell account-page">
      <header className="page-heading split-heading"><div><span className="kicker">My account</span><h1>Hello, {viewer.fullName || "customer"}.</h1><p>Manage profile and business account information.</p></div>{viewer.isStaff ? <Link className="button primary" href="/admin"><ShieldCheck size={17} /> Open Admin</Link> : null}</header>
      {viewer.demo ? <SetupNotice>Demo admin is active locally. Connect Supabase to use real accounts and persistence.</SetupNotice> : null}
      <div className="account-grid">
        <section className="account-card"><UserRound /><h2>Profile</h2><dl><div><dt>Name</dt><dd>{viewer.fullName || "Not provided"}</dd></div><div><dt>Email</dt><dd>{viewer.email}</dd></div><div><dt>Role</dt><dd>{viewer.role}</dd></div></dl></section>
        <section className="account-card">
          <Building2 />
          <h2>Tax exemption</h2>
          <p>Wholesale pricing and tax-exemption approval are stored as separate controls.</p>
          <span className={`status-pill status-${taxStatus.replaceAll("_", "-")}`}>
            {TAX_STATUS_COPY[taxStatus] ?? taxStatus}
          </span>
          <Link className="text-link" href="/account/tax-exemption">
            {taxStatus === "not_requested" || taxStatus === "rejected" ? "Apply for tax exemption" : "View application"}
          </Link>
        </section>
        <section className="account-card"><FileText /><h2>Invoices</h2><p>Customer-visible invoice history will appear here after sales are connected.</p><span className="status-pill status-not-requested">Coming soon</span></section>
      </div>
      <form action="/auth/signout" method="post"><button className="button secondary" type="submit">Sign out</button></form>
    </div>
  );
}
