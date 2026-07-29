import { redirect } from "next/navigation";
import { AdminNav } from "@/components/admin-nav";
import { AdminScaffoldNotice } from "@/components/admin-scaffold-notice";
import { TaxExemptionAlert } from "@/components/tax-exemption-alert";
import { getViewer } from "@/lib/auth";
import { getOpenOrdersCountForStaff } from "@/lib/data/orders";
import { isSupabaseAdminConfigured } from "@/lib/env";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getViewer();
  if (!viewer?.canAccessAdmin) redirect("/login?next=/admin&message=Staff%20access%20is%20required.");

  const openOrdersCount =
    !viewer.demo && isSupabaseAdminConfigured() ? await getOpenOrdersCountForStaff() : 0;

  return (
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
  );
}
