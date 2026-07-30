"use client";

import Image from "next/image";
import type { CustomerInvoiceView } from "@/lib/data/customer-invoice";
import type { StoreProfile } from "@/lib/store-profile";
import { PAYMENT_METHOD_LABELS } from "@/lib/business-order";
import { formatDate, usd } from "@/lib/format";

export function CustomerInvoiceDocument({
  invoice,
  store
}: {
  invoice: CustomerInvoiceView;
  store: StoreProfile;
}) {
  const payLabel = invoice.paymentMethod
    ? PAYMENT_METHOD_LABELS[invoice.paymentMethod] ?? invoice.paymentMethod
    : null;

  return (
    <article className="invoice-doc" id="customer-invoice">
      <header className="invoice-doc-top">
        <div className="invoice-doc-seller">
          <div className="invoice-doc-logo-wrap">
            <Image
              src={store.logoPath}
              alt={store.displayName}
              width={160}
              height={56}
              className="invoice-doc-logo"
              priority
            />
          </div>
          <div className="invoice-doc-seller-name">{store.legalName}</div>
          {store.addressLines.map((line) => (
            <div key={line} className="invoice-doc-muted">
              {line}
            </div>
          ))}
          {store.phone ? <div className="invoice-doc-muted">Phone: {store.phone}</div> : null}
          {store.email ? <div className="invoice-doc-muted">{store.email}</div> : null}
          {store.website ? (
            <div className="invoice-doc-muted">
              <a href={store.website}>{store.website.replace(/^https?:\/\//, "")}</a>
            </div>
          ) : null}
        </div>
        <div className="invoice-doc-meta">
          <h1 className="invoice-doc-title">INVOICE</h1>
          <dl className="invoice-doc-meta-list">
            <div>
              <dt>DATE</dt>
              <dd>{formatDate(invoice.issueDate)}</dd>
            </div>
            <div>
              <dt>INVOICE #</dt>
              <dd>{invoice.invoiceNumber}</dd>
            </div>
            <div>
              <dt>ORDER #</dt>
              <dd>{invoice.orderNumber}</dd>
            </div>
            {invoice.billTo.customerNumber ? (
              <div>
                <dt>CUSTOMER ID</dt>
                <dd>{invoice.billTo.customerNumber}</dd>
              </div>
            ) : null}
            <div>
              <dt>FULFILLMENT</dt>
              <dd>{invoice.fulfillmentMethod === "pickup" ? "Store pickup" : "Shipping"}</dd>
            </div>
          </dl>
        </div>
      </header>

      <section className="invoice-doc-billto">
        <div className="invoice-doc-section-label">BILL TO</div>
        <div className="invoice-doc-billto-body">
          <strong>{invoice.billTo.name}</strong>
          {invoice.billTo.companyName ? (
            <div className="invoice-doc-muted">Attn: {invoice.billTo.companyName}</div>
          ) : null}
          {invoice.fulfillmentMethod === "pickup" && !invoice.billTo.lines.length ? (
            <div className="invoice-doc-muted">Store pickup</div>
          ) : null}
          {invoice.billTo.lines.map((line) => (
            <div key={line}>{line}</div>
          ))}
          {invoice.billTo.phone ? (
            <div className="invoice-doc-muted">Phone: {invoice.billTo.phone}</div>
          ) : null}
          {invoice.billTo.email ? (
            <div className="invoice-doc-muted">{invoice.billTo.email}</div>
          ) : null}
        </div>
      </section>

      <div className="table-scroll invoice-doc-table-wrap">
        <table className="invoice-doc-table">
          <thead>
            <tr>
              <th>DESCRIPTION</th>
              <th className="num">QUANTITY</th>
              <th className="num">UNIT PRICE</th>
              <th className="num">AMOUNT</th>
            </tr>
          </thead>
          <tbody>
            {invoice.lines.map((line) => (
              <tr key={line.id}>
                <td>
                  <strong>{line.description}</strong>
                  {line.sku ? <div className="invoice-doc-muted">SKU {line.sku}</div> : null}
                  {line.note ? <div className="invoice-doc-muted">Note: {line.note}</div> : null}
                </td>
                <td className="num">{line.quantity}</td>
                <td className="num">{usd.format(line.unitPrice)}</td>
                <td className="num">{usd.format(line.amount)}</td>
              </tr>
            ))}
            {invoice.lines.length === 0 ? (
              <tr>
                <td colSpan={4} className="invoice-doc-muted">
                  No line items.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="invoice-doc-bottom">
        <section className="invoice-doc-comments">
          <div className="invoice-doc-section-label">OTHER COMMENTS</div>
          <ol>
            <li>{store.paymentTermsNote}</li>
            {payLabel ? <li>Payment method selected: {payLabel}</li> : null}
            {invoice.paymentStatus === "paid" && invoice.paidAt ? (
              <li>Paid on {formatDate(invoice.paidAt)}.</li>
            ) : invoice.paymentStatus === "pending" ? (
              <li>Payment pending — balance due {usd.format(invoice.balanceDue)}.</li>
            ) : invoice.paymentStatus === "partial" ? (
              <li>
                Partially paid. Balance due {usd.format(invoice.balanceDue)}.
              </li>
            ) : null}
            {invoice.fulfillmentMethod === "pickup" ? (
              <li>Store pickup — bring this invoice or order number and a photo ID.</li>
            ) : null}
          </ol>

          {(invoice.paymentMethod === "check" ||
            invoice.paymentMethod === "zelle" ||
            invoice.paymentMethod === "bank_transfer" ||
            invoice.paymentStatus === "pending") &&
          invoice.paymentStatus !== "paid" ? (
            <div className="invoice-pay-box">
              <strong>How to pay</strong>
              {(invoice.paymentMethod === "check" || !invoice.paymentMethod) &&
              (store.checkPayableTo || store.payableTo) ? (
                <div className="invoice-pay-block">
                  <span className="invoice-pay-label">Check</span>
                  <div>
                    Payable to: <strong>{store.checkPayableTo || store.payableTo}</strong>
                  </div>
                  {store.checkMailingNote ? (
                    <div className="invoice-doc-muted">{store.checkMailingNote}</div>
                  ) : null}
                </div>
              ) : null}
              {(invoice.paymentMethod === "zelle" || !invoice.paymentMethod) &&
              (store.zelleEmailOrPhone || store.zelleName) ? (
                <div className="invoice-pay-block">
                  <span className="invoice-pay-label">Zelle</span>
                  {store.zelleName ? (
                    <div>
                      Name: <strong>{store.zelleName}</strong>
                    </div>
                  ) : null}
                  {store.zelleEmailOrPhone ? (
                    <div>
                      Send to: <strong>{store.zelleEmailOrPhone}</strong>
                    </div>
                  ) : null}
                  {store.zelleInstructions ? (
                    <div className="invoice-doc-muted">{store.zelleInstructions}</div>
                  ) : null}
                </div>
              ) : null}
              {(invoice.paymentMethod === "bank_transfer" || !invoice.paymentMethod) &&
              (store.bankName || store.bankAccountNumber || store.bankRoutingNumber) ? (
                <div className="invoice-pay-block">
                  <span className="invoice-pay-label">Bank transfer</span>
                  {store.bankName ? (
                    <div>
                      Bank: <strong>{store.bankName}</strong>
                    </div>
                  ) : null}
                  {store.bankAccountName ? (
                    <div>
                      Account name: <strong>{store.bankAccountName}</strong>
                    </div>
                  ) : null}
                  {store.bankRoutingNumber ? (
                    <div>
                      Routing: <strong>{store.bankRoutingNumber}</strong>
                    </div>
                  ) : null}
                  {store.bankAccountNumber ? (
                    <div>
                      Account #: <strong>{store.bankAccountNumber}</strong>
                      {store.bankAccountType ? ` (${store.bankAccountType})` : ""}
                    </div>
                  ) : null}
                  {store.bankInstructions ? (
                    <div className="invoice-doc-muted">{store.bankInstructions}</div>
                  ) : null}
                </div>
              ) : null}
              <div className="invoice-doc-muted" style={{ marginTop: 8 }}>
                Always include order <strong>{invoice.orderNumber}</strong> or invoice{" "}
                <strong>{invoice.invoiceNumber}</strong> as the payment reference.
              </div>
            </div>
          ) : null}
        </section>

        <section className="invoice-doc-totals">
          <div>
            <span>Subtotal</span>
            <strong>{usd.format(invoice.subtotal)}</strong>
          </div>
          {invoice.discountAmount > 0 ? (
            <div>
              <span>Discount</span>
              <strong>−{usd.format(invoice.discountAmount)}</strong>
            </div>
          ) : null}
          <div>
            <span>Taxable</span>
            <strong>
              {usd.format(Math.max(0, invoice.subtotal - invoice.discountAmount))}
            </strong>
          </div>
          <div>
            <span>Tax due</span>
            <strong>{usd.format(invoice.taxAmount)}</strong>
          </div>
          <div>
            <span>Shipping</span>
            <strong>
              {invoice.shippingAmount > 0 ? usd.format(invoice.shippingAmount) : "$0.00"}
            </strong>
          </div>
          <div className="invoice-doc-total-due">
            <span>TOTAL Due</span>
            <strong>{usd.format(invoice.total)}</strong>
          </div>
          {invoice.amountPaid > 0 ? (
            <div>
              <span>Amount paid</span>
              <strong>{usd.format(invoice.amountPaid)}</strong>
            </div>
          ) : null}
          {invoice.balanceDue > 0.009 ? (
            <div>
              <span>Balance due</span>
              <strong>{usd.format(invoice.balanceDue)}</strong>
            </div>
          ) : null}
        </section>
      </div>

      <footer className="invoice-doc-footer">
        <p>
          Make all checks payable to{" "}
          <strong>{store.checkPayableTo || store.payableTo || store.legalName}</strong>
        </p>
        <p className="invoice-doc-muted">
          Thank you for your business. Questions? {store.email || "Contact the store."}
        </p>
      </footer>
    </article>
  );
}

export function InvoicePrintActions() {
  return (
    <div className="invoice-actions no-print">
      <button className="button primary" type="button" onClick={() => window.print()}>
        Save / Print invoice
      </button>
      <p className="field-hint">
        Use your browser print dialog → “Save as PDF” to keep a copy.
      </p>
    </div>
  );
}
