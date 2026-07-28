import { AdminPageHeader } from "@/components/admin-page-header";
import { ActivityLogViewer } from "@/components/activity-log-viewer";
import { requireAdminAccessPage } from "@/lib/auth";
import { getAuditLogsForStaff } from "@/lib/data/audit-log";

export const metadata = { title: "Activity log" };

/** Staff + seller xem nhật ký — mỗi dòng có tên nhân viên đã sửa order/customer/… */
export default async function ActivityLogPage() {
  await requireAdminAccessPage();
  const entries = await getAuditLogsForStaff(300);

  return (
    <>
      <AdminPageHeader
        eyebrow="Audit"
        title="Activity log"
        description="Every product, order, inventory, and customer change is recorded with the staff member’s name, time, and before/after values."
      />
      <ActivityLogViewer entries={entries} />
    </>
  );
}
