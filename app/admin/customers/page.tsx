import { AdminPageHeader } from "@/components/admin-page-header";
import { CustomerManager } from "@/components/customer-manager";
import { getViewer, requireStaffPage } from "@/lib/auth";
import { getCustomersForStaff } from "@/lib/data/customers";

export const metadata = { title: "Customers" };

export default async function CustomersPage() {
  await requireStaffPage();
  const [viewer, customers] = await Promise.all([getViewer(), getCustomersForStaff()]);

  return (
    <>
      <AdminPageHeader
        eyebrow="Relationships"
        title="Customers"
        description="Manage guest, retail, and wholesale customers, contact details, status, and exemption review."
      />
      {/* Xoá là thao tác không hoàn tác được nên chỉ manager/admin thấy nút. */}
      <CustomerManager customers={customers} canDelete={Boolean(viewer?.isManager)} />
      <div className="legal-callout compact">
        <h2>Wholesale is not the same as tax exempt</h2>
        <p>
          Price level and exemption approval are separate fields. Exemption status changes through the tax
          exemption review queue, not from this screen.
        </p>
      </div>
    </>
  );
}
