import { AdminPageHeader } from "@/components/admin-page-header";
import { CustomerManager } from "@/components/customer-manager";
import { requireAdminAccessPage } from "@/lib/auth";
import { getCustomersForStaff } from "@/lib/data/customers";

export const metadata = { title: "Customers" };

export default async function CustomersPage() {
  // Seller + staff: tra cứu / cập nhật khách sỉ cho giao dịch hằng ngày.
  // Xoá vĩnh viễn vẫn chỉ manager/admin (canDelete).
  const viewer = await requireAdminAccessPage();
  const customers = await getCustomersForStaff();

  return (
    <>
      <AdminPageHeader
        eyebrow={viewer.isSeller ? "Bán sỉ" : "Relationships"}
        title="Customers"
        description={
          viewer.isSeller
            ? "Khách sỉ và liên hệ cho đơn hàng hằng ngày. Xem type wholesale/retail, trạng thái, và cập nhật thông tin liên lạc."
            : "Manage guest, retail, and wholesale customers, contact details, status, and exemption review."
        }
      />
      <CustomerManager customers={customers} canDelete={Boolean(viewer.isManager)} />
      {!viewer.isSeller ? (
        <div className="legal-callout compact">
          <h2>Wholesale is not the same as tax exempt</h2>
          <p>
            Price level and exemption approval are separate fields. Exemption status changes through the tax
            exemption review queue, not from this screen.
          </p>
        </div>
      ) : null}
    </>
  );
}
