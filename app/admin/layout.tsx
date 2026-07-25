import { redirect } from "next/navigation";
import { AdminNav } from "@/components/admin-nav";
import { AdminScaffoldNotice } from "@/components/admin-scaffold-notice";
import { TaxExemptionAlert } from "@/components/tax-exemption-alert";
import { getViewer } from "@/lib/auth";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getViewer();
  if (!viewer?.isStaff) redirect("/login?next=/admin&message=Staff%20access%20is%20required.");

  return (
    <div className="admin-shell shell-wide">
      <AdminNav />
      <div className="admin-content">
        <AdminScaffoldNotice demo={viewer.demo} />
        <TaxExemptionAlert />
        {children}
      </div>
    </div>
  );
}
