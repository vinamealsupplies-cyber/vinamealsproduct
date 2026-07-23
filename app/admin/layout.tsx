import { redirect } from "next/navigation";
import { AdminNav } from "@/components/admin-nav";
import { SetupNotice } from "@/components/setup-notice";
import { getViewer } from "@/lib/auth";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getViewer();
  if (!viewer?.isStaff) redirect("/login?next=/admin&message=Staff%20access%20is%20required.");

  return (
    <div className="admin-shell shell-wide">
      <AdminNav />
      <div className="admin-content">
        <SetupNotice>
          {viewer.demo
            ? "Admin demo mode is active. Configure Supabase and disable APP_DEMO_MODE before deployment."
            : "UI scaffold data is shown on these admin pages until the database query and mutation layer is connected."}
        </SetupNotice>
        {children}
      </div>
    </div>
  );
}
