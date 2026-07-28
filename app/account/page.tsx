import Link from "next/link";
import { Building2, FileText, MapPin, Package, ShieldCheck, UserRound } from "lucide-react";
import { ProfileEditor } from "@/components/profile-editor";
import { PurchaseHistory } from "@/components/purchase-history";
import { SetupNotice } from "@/components/setup-notice";
import { getViewer } from "@/lib/auth";
import { getOwnShippingAddresses } from "@/lib/data/addresses";
import { getOwnOrders } from "@/lib/data/customer-orders";
import { getOwnCustomer } from "@/lib/data/tax-exemption";
import { formatUsPhoneDisplay } from "@/lib/data/us-states";
import { isSupabaseAdminConfigured } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

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
    return (
      <div className="page-shell shell narrow-page">
        <div className="empty-state large">
          <UserRound size={36} />
          <h1>Sign in to view your account</h1>
          <p>Access your profile, purchase history, business status, and addresses.</p>
          <Link className="button primary" href="/login?next=/account">
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  const canLoad = !viewer.demo && isSupabaseAdminConfigured();
  const [customer, addresses, orders, profileRow] = await Promise.all([
    canLoad ? getOwnCustomer(viewer.id) : Promise.resolve(null),
    canLoad ? getOwnShippingAddresses(viewer.id) : Promise.resolve([]),
    canLoad ? getOwnOrders(viewer.id) : Promise.resolve([]),
    canLoad
      ? createAdminClient()
          .from("profiles")
          .select("full_name, phone")
          .eq("id", viewer.id)
          .maybeSingle()
          .then((r) => r.data)
      : Promise.resolve(null)
  ]);
  const taxStatus = customer?.tax_exempt_status ?? "not_requested";
  const defaultAddress = addresses.find((a) => a.isDefault) ?? addresses[0] ?? null;
  const openCount = orders.filter((o) => o.isOpen).length;
  const pastCount = orders.length - openCount;

  const profileFullName =
    profileRow?.full_name?.trim() ||
    [customer?.first_name, customer?.last_name].filter(Boolean).join(" ") ||
    viewer.fullName ||
    "";
  const profilePhone = profileRow?.phone?.trim() || customer?.phone?.trim() || "";
  const profileCompany = customer?.company_name?.trim() || "";

  return (
    <div className="page-shell shell account-page">
      <header className="page-heading split-heading">
        <div>
          <span className="kicker">My account</span>
          <h1>Hello, {viewer.fullName || "customer"}.</h1>
          <p>Profile, purchase history, and business account information.</p>
        </div>
        {viewer.isStaff ? (
          <Link className="button primary" href="/admin">
            <ShieldCheck size={17} /> Open Admin
          </Link>
        ) : viewer.isSeller ? (
          <Link className="button primary" href="/admin">
            <ShieldCheck size={17} /> Seller workspace
          </Link>
        ) : null}
      </header>
      {viewer.demo ? (
        <SetupNotice>
          Demo admin is active locally. Connect Supabase to use real accounts and persistence.
        </SetupNotice>
      ) : null}

      <div id="profile" className="account-profile-block">
        {viewer.demo ? (
          <section className="account-card">
            <UserRound />
            <h2>Profile</h2>
            <p>Connect Supabase (turn off demo mode) to edit your name, phone, and company.</p>
          </section>
        ) : (
          <ProfileEditor
            initial={{
              fullName: profileFullName,
              email: viewer.email,
              phone: profilePhone ? formatUsPhoneDisplay(profilePhone) || profilePhone : "",
              companyName: profileCompany,
              role: viewer.role
            }}
          />
        )}
      </div>

      <div className="account-grid">
        <section className="account-card">
          <Package />
          <h2 className="orders-heading-with-badge">
            Orders
            {openCount > 0 ? (
              <span className="order-count-badge" aria-label={`${openCount} incomplete orders`}>
                {openCount}
              </span>
            ) : null}
          </h2>
          {orders.length ? (
            <>
              <p>
                {openCount > 0
                  ? `${openCount} order${openCount === 1 ? "" : "s"} not completed yet`
                  : "No open orders right now"}
                {pastCount > 0 ? ` · ${pastCount} completed or cancelled` : ""}.
              </p>
              <span className={`status-pill ${openCount ? "status-confirmed" : "status-fulfilled"}`}>
                {openCount ? "In progress" : "All caught up"}
              </span>
            </>
          ) : (
            <>
              <p>Your purchase history and live order status appear below after you place an order.</p>
              <span className="status-pill status-not-requested">No orders yet</span>
            </>
          )}
          <a className="text-link" href="#purchase-history">
            View purchase history
          </a>
        </section>

        <section className="account-card">
          <MapPin />
          <h2>Shipping addresses</h2>
          {defaultAddress ? (
            <>
              <p>
                {defaultAddress.recipientName ? `${defaultAddress.recipientName} · ` : ""}
                {defaultAddress.line1}, {defaultAddress.city}, {defaultAddress.stateRegion}{" "}
                {defaultAddress.postalCode}
                {defaultAddress.phone ? ` · ${formatUsPhoneDisplay(defaultAddress.phone)}` : ""}
              </p>
              <span className="status-pill status-approved">{addresses.length} saved</span>
            </>
          ) : (
            <>
              <p>Save U.S. delivery addresses for faster checkout.</p>
              <span className="status-pill status-not-requested">None saved</span>
            </>
          )}
          <Link className="text-link" href="/account/addresses">
            {addresses.length ? "Manage addresses" : "Add new address"}
          </Link>
        </section>

        <section className="account-card">
          <Building2 />
          <h2>Tax exemption</h2>
          <p>Wholesale pricing and tax-exemption approval are stored as separate controls.</p>
          <span className={`status-pill status-${taxStatus.replaceAll("_", "-")}`}>
            {TAX_STATUS_COPY[taxStatus] ?? taxStatus}
          </span>
          <Link className="text-link" href="/account/tax-exemption">
            {taxStatus === "not_requested" || taxStatus === "rejected"
              ? "Apply for tax exemption"
              : "View application"}
          </Link>
        </section>

        <section className="account-card">
          <FileText />
          <h2>Invoices</h2>
          <p>Customer-visible invoice history will appear here after billing is fully connected.</p>
          <span className="status-pill status-not-requested">Coming soon</span>
        </section>
      </div>

      <div id="purchase-history">
        <PurchaseHistory orders={orders} />
      </div>

      <form action="/auth/signout" method="post">
        <button className="button secondary" type="submit">
          Sign out
        </button>
      </form>
    </div>
  );
}
