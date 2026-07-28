import { AdminPageHeader } from "@/components/admin-page-header";
import { ActivityLogViewer } from "@/components/activity-log-viewer";
import { requireStaffPage } from "@/lib/auth";
import { getAuditLogsForStaff } from "@/lib/data/audit-log";

export const metadata = { title: "Activity log" };

/** Staff/admin xem nhật ký thao tác seller & staff (products, orders, inventory…). */
export default async function ActivityLogPage() {
  await requireStaffPage();
  const entries = await getAuditLogsForStaff(300);

  return (
    <>
      <AdminPageHeader
        eyebrow="Audit"
        title="Activity log"
        description="Every product, order, inventory, and customer change made by sellers or staff is recorded here with who, when, and before/after."
      />
      <ActivityLogViewer entries={entries} />
    </>
  );
}
