import Link from "next/link";
import { AdminPageHeader } from "@/components/admin-page-header";
import { InvoiceSendButton } from "@/components/invoice-send-button";
import { requireAdminAccessPage } from "@/lib/auth";
import { getInvoices } from "@/lib/data/reporting";
import { formatDate, usd } from "@/lib/format";

export const metadata = { title: "Invoices" };

// Đã trả đủ = status 'paid' hoặc không còn số dư.
function isSettled(status: string, balance: number) {
  return status === "paid" || balance <= 0;
}

export default async function InvoicesPage() {
  await requireAdminAccessPage();
  const invoices = await getInvoices();

  return (
    <>
      <AdminPageHeader
        eyebrow="Billing"
        title="Invoices"
        description="Gửi biên nhận cho invoice đã thanh toán, hoặc nhắc thanh toán với invoice còn số dư. Thư gửi tới email khách dùng để đăng nhập và được lưu vào hộp thư chung."
      />

      <div className="data-table-card">
        {invoices.length === 0 ? (
          <div className="empty-state">
            <p>Chưa có invoice nào.</p>
          </div>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Khách hàng</th>
                  <th>Ngày phát hành</th>
                  <th className="numeric">Tổng</th>
                  <th className="numeric">Đã nhận</th>
                  <th className="numeric">Còn lại</th>
                  <th>Trạng thái</th>
                  <th>Gửi thư</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((invoice) => {
                  const settled = isSettled(invoice.status, invoice.balanceDue);
                  return (
                    <tr key={invoice.id}>
                      <td>
                        <Link className="text-link" href={`/admin/invoices/${invoice.id}`}>
                          {invoice.number ?? "Xem invoice"}
                        </Link>
                      </td>
                      <td>{invoice.customer}</td>
                      <td>{formatDate(invoice.issueDate)}</td>
                      <td className="numeric">{usd.format(invoice.total)}</td>
                      <td className="numeric">{usd.format(invoice.paid)}</td>
                      <td className="numeric">{usd.format(invoice.balanceDue)}</td>
                      <td>
                        <span className={`status-pill status-${invoice.status}`}>
                          {invoice.status}
                        </span>
                      </td>
                      <td>
                        <InvoiceSendButton invoiceId={invoice.id} isPaid={settled} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
