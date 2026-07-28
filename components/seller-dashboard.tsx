import Link from "next/link";
import {
  ArrowRight,
  Boxes,
  CircleDollarSign,
  FileText,
  PackagePlus,
  ShoppingBasket,
  UsersRound
} from "lucide-react";
import { AdminPageHeader } from "@/components/admin-page-header";
import { MetricCard } from "@/components/metric-card";
import type { SellerDashboard } from "@/lib/data/seller-dashboard";
import { formatDate, usd } from "@/lib/format";

const QUICK_LINKS = [
  {
    href: "/admin/orders",
    label: "Orders",
    detail: "Giao / pickup / huỷ đơn",
    icon: PackagePlus
  },
  {
    href: "/admin/products",
    label: "Products",
    detail: "Thêm & sửa sản phẩm",
    icon: ShoppingBasket
  },
  {
    href: "/admin/customers",
    label: "Customers",
    detail: "Khách sỉ / liên hệ",
    icon: UsersRound
  },
  {
    href: "/admin/invoices",
    label: "Invoices",
    detail: "Hoá đơn & công nợ",
    icon: FileText
  },
  {
    href: "/admin/payments",
    label: "Payments",
    detail: "Thu tiền trong ngày",
    icon: CircleDollarSign
  },
  {
    href: "/admin/inventory",
    label: "Inventory",
    detail: "Tồn kho & giá bán",
    icon: Boxes
  }
] as const;

export function SellerDashboardView({ data }: { data: SellerDashboard }) {
  const cards = [
    {
      label: "Chờ pickup",
      value: String(data.awaitingPickup),
      detail: data.awaitingPickup
        ? "Cần xác nhận khi khách lấy hàng"
        : "Không có đơn chờ lấy"
    },
    {
      label: "Đơn mở",
      value: String(data.openOrders),
      detail: "Trạng thái confirmed — đang xử lý"
    },
    {
      label: "Hoá đơn còn nợ",
      value: String(data.unpaidInvoices),
      detail: data.outstandingBalance > 0
        ? `${usd.format(data.outstandingBalance)} còn phải thu`
        : "Không còn số dư"
    },
    {
      label: "Đơn hôm nay",
      value: String(data.todayOrderCount),
      detail:
        data.todayOrderCount > 0
          ? `${usd.format(data.todayOrderTotal)} tổng giá trị`
          : "Chưa có đơn trong ngày"
    }
  ];

  return (
    <>
      <AdminPageHeader
        eyebrow="Seller workspace"
        title="Giao dịch hằng ngày"
        description="Bán buôn hằng ngày: đơn (giao/huỷ), sản phẩm, khách sỉ, hoá đơn, thu tiền, tồn kho. Mọi thao tác được ghi Activity log cho admin."
      />

      <section className="metric-grid">
        {cards.map((metric) => (
          <MetricCard key={metric.label} {...metric} />
        ))}
      </section>

      <section className="seller-quick-links" aria-label="Seller shortcuts">
        {QUICK_LINKS.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.href} className="seller-quick-card" href={item.href}>
              <Icon size={22} aria-hidden="true" />
              <div>
                <strong>{item.label}</strong>
                <p>{item.detail}</p>
              </div>
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          );
        })}
      </section>

      <section className="admin-two-column">
        <article className="admin-panel">
          <div className="panel-heading">
            <div>
              <h2>Chờ khách pickup</h2>
              <p>Đơn đã xác nhận — chưa lấy hàng</p>
            </div>
            <Link className="text-link" href="/admin/orders">
              Tất cả đơn <ArrowRight size={15} />
            </Link>
          </div>
          {data.recentAwaiting.length ? (
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Đơn</th>
                    <th>Khách</th>
                    <th>Ngày</th>
                    <th className="num">Tổng</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recentAwaiting.map((order) => (
                    <tr key={order.id} className="row-awaiting-pickup">
                      <td>{order.number}</td>
                      <td>{order.customer}</td>
                      <td>{formatDate(order.createdAt)}</td>
                      <td className="num">{usd.format(order.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="field-hint">Không có đơn chờ pickup.</p>
          )}
        </article>

        <article className="admin-panel attention-panel">
          <div className="panel-heading">
            <div>
              <h2>Cần chú ý</h2>
              <p>Ưu tiên trong ca làm việc</p>
            </div>
          </div>
          <div className="attention-list">
            <Link href="/admin/orders">
              <span className="attention-count">{data.awaitingPickup}</span>
              <div>
                <strong>Pickup chưa xong</strong>
                <p>Xác nhận khi khách đã lấy hàng.</p>
              </div>
              <ArrowRight size={17} />
            </Link>
            <Link href="/admin/invoices">
              <span className="attention-count">{data.unpaidInvoices}</span>
              <div>
                <strong>Hoá đơn còn nợ</strong>
                <p>Theo dõi thu tiền bán sỉ.</p>
              </div>
              <ArrowRight size={17} />
            </Link>
            <Link href="/admin/inventory">
              <span className="attention-count">{data.lowStockSkus}</span>
              <div>
                <strong>SKU sắp hết / hết hàng</strong>
                <p>Kiểm trước khi nhận đơn sỉ lớn.</p>
              </div>
              <ArrowRight size={17} />
            </Link>
          </div>
        </article>
      </section>

      {data.recentUnpaid.length ? (
        <section className="admin-section">
          <div className="section-heading split-heading">
            <div>
              <h2>Công nợ gần đây</h2>
              <p>Hoá đơn còn số dư — bấm xem toàn bộ để thu tiền.</p>
            </div>
            <Link className="text-link" href="/admin/invoices">
              Invoices <ArrowRight size={15} />
            </Link>
          </div>
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Customer</th>
                  <th className="num">Total</th>
                  <th className="num">Balance</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {data.recentUnpaid.map((inv) => (
                  <tr key={inv.id ?? inv.number}>
                    <td>{inv.number}</td>
                    <td>{inv.customer}</td>
                    <td className="num">{usd.format(inv.total)}</td>
                    <td className="num">{usd.format(inv.balanceDue)}</td>
                    <td>
                      <span className={`status-pill status-${inv.status}`}>{inv.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </>
  );
}
