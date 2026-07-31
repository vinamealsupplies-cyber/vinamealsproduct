import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ExternalLink, Store } from "lucide-react";
import { AdminNav } from "@/components/admin-nav";
import { AdminScaffoldNotice } from "@/components/admin-scaffold-notice";
import { TaxExemptionAlert } from "@/components/tax-exemption-alert";
import { getViewer } from "@/lib/auth";
import { getOpenOrdersCountForStaff } from "@/lib/data/orders";
import { isSupabaseAdminConfigured } from "@/lib/env";

/**
 * Admin-only shell: no shop announcement bar, search, cart, or storefront footer.
 * Staff open the shop in a separate tab via “Open shop”.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getViewer();
  if (!viewer?.canAccessAdmin) {
    redirect("/login?next=/admin&message=Staff%20access%20is%20required.");
  }

  const openOrdersCount =
    !viewer.demo && isSupabaseAdminConfigured() ? await getOpenOrdersCountForStaff() : 0;

  return (
    <div className="admin-app">
      <header className="admin-topbar">
        <div className="admin-topbar-brand">
          <Image
            src="/logo-mark.png"
            alt=""
            width={32}
            height={32}
            className="admin-topbar-logo"
          />
          <div>
            <strong>Vinameals Admin</strong>
            <span>
              {viewer.isSeller ? "Seller workspace" : "Store administration"}
              {viewer.email ? ` · ${viewer.email}` : ""}
            </span>
          </div>
        </div>
        <div className="admin-topbar-actions">
          <Link className="button secondary compact" href="/" target="_blank" rel="noopener noreferrer">
            <Store size={15} aria-hidden="true" />
            Open shop
            <ExternalLink size={13} aria-hidden="true" />
          </Link>
        </div>
      </header>

      <div className="admin-shell shell-wide">
        <AdminNav
          isSeller={viewer.isSeller}
          isAdmin={viewer.isAdmin}
          openOrdersCount={openOrdersCount}
        />
        <div className="admin-content">
          <AdminScaffoldNotice demo={viewer.demo} />
          <TaxExemptionAlert />
          {children}
        </div>
      </div>
    </div>
  );
}
