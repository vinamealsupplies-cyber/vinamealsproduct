import Link from "next/link";
import { Building2, FileText, ShieldCheck, UserRound } from "lucide-react";
import { getViewer } from "@/lib/auth";
import { SetupNotice } from "@/components/setup-notice";

export default async function AccountPage() {
  const viewer = await getViewer();
  if (!viewer) {
    return <div className="page-shell shell narrow-page"><div className="empty-state large"><UserRound size={36} /><h1>Sign in to view your account</h1><p>Access your profile, business status, invoices, and order history.</p><Link className="button primary" href="/login?next=/account">Sign in</Link></div></div>;
  }

  return (
    <div className="page-shell shell account-page">
      <header className="page-heading split-heading"><div><span className="kicker">My account</span><h1>Hello, {viewer.fullName || "customer"}.</h1><p>Manage profile and business account information.</p></div>{viewer.isStaff ? <Link className="button primary" href="/admin"><ShieldCheck size={17} /> Open Admin</Link> : null}</header>
      {viewer.demo ? <SetupNotice>Demo admin is active locally. Connect Supabase to use real accounts and persistence.</SetupNotice> : null}
      <div className="account-grid">
        <section className="account-card"><UserRound /><h2>Profile</h2><dl><div><dt>Name</dt><dd>{viewer.fullName || "Not provided"}</dd></div><div><dt>Email</dt><dd>{viewer.email}</dd></div><div><dt>Role</dt><dd>{viewer.role}</dd></div></dl></section>
        <section className="account-card"><Building2 /><h2>Business account</h2><p>Wholesale pricing and tax-exemption approval are stored as separate controls.</p><span className="status-pill status-not-requested">Not requested</span></section>
        <section className="account-card"><FileText /><h2>Invoices</h2><p>Customer-visible invoice history will appear here after sales are connected.</p><Link className="text-link" href="#">View invoice history</Link></section>
      </div>
      <form action="/auth/signout" method="post"><button className="button secondary" type="submit">Sign out</button></form>
    </div>
  );
}
