import Link from "next/link";
import { ChevronDown } from "lucide-react";
import type { SalesTaxFilters, SalesTaxGroup, SalesTaxReport } from "@/lib/data/sales-tax-report";
import { usd } from "@/lib/format";

const BASE = "/admin/reports/california-sales-tax";

function pct(rate: number) {
  return `${(rate * 100).toFixed(3).replace(/\.?0+$/, "")}%`;
}

function jurisdictionName(group: SalesTaxGroup) {
  const parts = [group.city, group.county ? `${group.county} County` : "", group.state].filter(
    Boolean
  );
  return parts.join(" · ") || group.state || "—";
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="tax-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function paymentLabel(status: string) {
  return status.replace(/_/g, " ");
}

export function SalesTaxReportView({
  report,
  filters
}: {
  report: SalesTaxReport;
  filters: SalesTaxFilters;
}) {
  const { totals, groups } = report;

  return (
    <div className="sales-tax-report">
      {/* Filters */}
      <form className="form-card tax-filter" method="get">
        <div className="form-grid tax-filter-grid">
          <label>
            From
            <input type="date" name="from" defaultValue={filters.from ?? ""} />
          </label>
          <label>
            To
            <input type="date" name="to" defaultValue={filters.to ?? ""} />
          </label>
          <label>
            State
            <input name="state" defaultValue={filters.state ?? ""} maxLength={2} placeholder="CA" />
          </label>
          <label>
            City
            <input name="city" defaultValue={filters.city ?? ""} placeholder="Garden Grove" />
          </label>
          <label>
            County
            <input name="county" defaultValue={filters.county ?? ""} placeholder="Orange" />
          </label>
          <label>
            ZIP
            <input name="zip" defaultValue={filters.zip ?? ""} placeholder="92843" inputMode="numeric" />
          </label>
          <label>
            Tax rate (%)
            <input name="rate" defaultValue={filters.rate ?? ""} placeholder="8.75" inputMode="decimal" />
          </label>
        </div>
        <div className="button-row">
          <button className="button primary" type="submit">
            Apply filters
          </button>
          <Link className="button ghost" href={BASE}>
            Clear
          </Link>
        </div>
      </form>

      {/* Totals */}
      <div className="form-card tax-totals">
        <h2>Totals {filters.from || filters.to ? "(filtered period)" : "(all time)"}</h2>
        <div className="tax-metric-grid">
          <Metric label="Orders" value={String(totals.orderCount)} />
          <Metric label="Gross sales" value={usd.format(totals.grossSales)} />
          <Metric label="Taxable sales" value={usd.format(totals.taxableSales)} />
          <Metric label="Exempt sales" value={usd.format(totals.exemptSales)} />
          <Metric label="Shipping" value={usd.format(totals.shipping)} />
          <Metric label="Tax collected" value={usd.format(totals.taxCollected)} />
          <Metric label="State tax" value={usd.format(totals.stateTax)} />
          <Metric label="District tax" value={usd.format(totals.districtTax)} />
        </div>
      </div>

      {/* Grouped jurisdictions */}
      {groups.length === 0 ? (
        <div className="form-card">
          <p className="field-hint">No orders match these filters.</p>
        </div>
      ) : (
        <div className="tax-group-list">
          {groups.map((group) => (
            <details className="form-card tax-group" key={group.key}>
              <summary className="tax-group-summary">
                <div className="tax-group-head">
                  <strong>{jurisdictionName(group)}</strong>
                  <span className="field-hint">
                    {group.zip ? `ZIP ${group.zip} · ` : ""}Rate {pct(group.taxRate)} ·{" "}
                    {group.orderCount} order{group.orderCount === 1 ? "" : "s"}
                  </span>
                </div>
                <div className="tax-group-metrics">
                  <span>
                    Gross <strong>{usd.format(group.grossSales)}</strong>
                  </span>
                  <span>
                    Taxable <strong>{usd.format(group.taxableSales)}</strong>
                  </span>
                  <span>
                    Exempt <strong>{usd.format(group.exemptSales)}</strong>
                  </span>
                  <span>
                    Shipping <strong>{usd.format(group.shipping)}</strong>
                  </span>
                  <span className="tax-group-tax">
                    Tax <strong>{usd.format(group.taxCollected)}</strong>
                  </span>
                  <ChevronDown className="tax-group-chevron" size={18} aria-hidden="true" />
                </div>
              </summary>

              <div className="table-scroll">
                <table className="data-table tax-order-table">
                  <thead>
                    <tr>
                      <th>Order</th>
                      <th>Date</th>
                      <th>Payment</th>
                      <th>Ship to</th>
                      <th className="numeric">Gross</th>
                      <th className="numeric">Taxable</th>
                      <th className="numeric">Exempt</th>
                      <th className="numeric">Shipping</th>
                      <th className="numeric">State tax</th>
                      <th className="numeric">District tax</th>
                      <th className="numeric">Tax</th>
                      <th className="numeric">Refund</th>
                      <th className="numeric">Net taxable</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.orders.map((order) => (
                      <tr key={order.orderId}>
                        <td>{order.orderNumber}</td>
                        <td>{order.orderDate ?? "—"}</td>
                        <td>
                          <span className="status-badge">{paymentLabel(order.paymentStatus)}</span>
                        </td>
                        <td>
                          <span className="field-hint">{order.shippingAddress ?? "—"}</span>
                        </td>
                        <td className="numeric">{usd.format(order.grossSales)}</td>
                        <td className="numeric">{usd.format(order.totalTaxable)}</td>
                        <td className="numeric">{usd.format(order.exemptAmount)}</td>
                        <td className="numeric">{usd.format(order.shipping)}</td>
                        <td className="numeric">{usd.format(order.stateTax)}</td>
                        <td className="numeric">{usd.format(order.districtTax)}</td>
                        <td className="numeric">{usd.format(order.taxCollected)}</td>
                        <td className="numeric">
                          {order.refundAmount > 0 ? usd.format(order.refundAmount) : "—"}
                        </td>
                        <td className="numeric">{usd.format(order.netTaxableSales)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}
