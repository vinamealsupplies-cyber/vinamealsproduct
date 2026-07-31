import Link from "next/link";
import { Building2, FileText, MapPin, Package, ShieldCheck, UserRound } from "lucide-react";
import { SetupNotice } from "@/components/setup-notice";
import { getViewer } from "@/lib/auth";
import { getOwnShippingAddresses } from "@/lib/data/addresses";
import { getOwnOrders } from "@/lib/data/customer-orders";
import {
  TAX_STATUS_LABELS,
  WHOLESALE_STATUS_LABELS
} from "@/lib/business-application/constants";
import { getOwnCustomerForBusinessApp } from "@/lib/data/business-applications";
import { formatUsPhoneDisplay } from "@/lib/data/us-states";
import { isSupabaseAdminConfigured } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

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
    canLoad ? getOwnCustomerForBusinessApp(viewer.id) : Promise.resolve(null),
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
  const wholesaleStatus =
    (customer as { wholesale_status?: string } | null)?.wholesale_status ??
    (customer?.customer_type === "wholesale" ? "approved" : "not_requested");
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

      <div className="account-grid">
        <section className="account-card">
          <UserRound />
          <h2>Profile</h2>
          {viewer.demo ? (
            <p>Connect Supabase (turn off demo mode) to edit your name, phone, and company.</p>
          ) : (
            <>
              <p>
                {profileFullName || "No name saved yet"}
                {profilePhone
                  ? ` · ${formatUsPhoneDisplay(profilePhone) || profilePhone}`
                  : ""}
                {profileCompany ? ` · ${profileCompany}` : ""}
              </p>
              <span className={`status-pill ${profileFullName ? "status-approved" : "status-not-requested"}`}>
                {viewer.email}
              </span>
              <Link className="text-link" href="/account/profile">
                Edit profile
              </Link>
            </>
          )}
        </section>

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
              <p>Your orders, invoices, and live status appear here after you place an order.</p>
              <span className="status-pill status-not-requested">No orders yet</span>
            </>
          )}
          <Link className="text-link" href="/account/orders">
            Orders &amp; purchase history
          </Link>
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
          <h2>Business &amp; tax exemption</h2>
          <p>Wholesale pricing and tax-exempt status are reviewed separately.</p>
          <div style={{ display: "grid", gap: 6 }}>
            <span className={`status-pill status-${String(wholesaleStatus).replaceAll("_", "-")}`}>
              Wholesale:{" "}
              {WHOLESALE_STATUS_LABELS[wholesaleStatus] ??
                (customer?.customer_type === "wholesale" ? "Approved" : wholesaleStatus)}
            </span>
            <span className={`status-pill status-${taxStatus.replaceAll("_", "-")}`}>
              Tax:{" "}
              {TAX_STATUS_LABELS[taxStatus] ??
                ({
                  not_requested: "Not requested",
                  pending: "Pending review",
                  approved: "Approved",
                  rejected: "Rejected",
                  expired: "Expired"
                } as Record<string, string>)[taxStatus] ??
                taxStatus}
            </span>
          </div>
          <Link className="text-link" href="/account/business-application">
            {taxStatus === "not_requested" &&
            (wholesaleStatus === "not_requested" || !wholesaleStatus)
              ? "Apply for wholesale & resale"
              : "View applications"}
          </Link>
        </section>

        <section className="account-card">
          <FileText />
          <h2>Invoices</h2>
          <p>
            Open any past order and tap <strong>View invoice</strong> to print or save as PDF.
          </p>
          <span className="status-pill status-approved">From order history</span>
          <Link className="text-link" href="/account/orders">
            Go to orders
          </Link>
        </section>
      </div>

      <form action="/auth/signout" method="post">
        <button className="button secondary" type="submit">
          Sign out
        </button>
      </form>
    </div>
  );
}
