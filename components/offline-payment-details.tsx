"use client";

import { AlertTriangle, Landmark } from "lucide-react";
import {
  PAYMENT_METHOD_LABELS,
  type OfflinePaymentMethod
} from "@/lib/business-order";
import type { StoreBusinessProfile } from "@/lib/store-profile";
import { usd } from "@/lib/format";

/**
 * Payment instructions for check / Zelle / bank transfer.
 * Shown at checkout when method is selected, and after order with order number.
 */
export function OfflinePaymentDetails({
  method,
  store,
  orderNumber,
  invoiceNumber,
  amountDue,
  compact = false
}: {
  method: OfflinePaymentMethod;
  store: StoreBusinessProfile;
  /** After place order — required in memo. */
  orderNumber?: string | null;
  invoiceNumber?: string | null;
  amountDue?: number | null;
  compact?: boolean;
}) {
  const title = PAYMENT_METHOD_LABELS[method] ?? method;

  return (
    <div
      className={
        compact ? "offline-pay-box offline-pay-box-compact" : "offline-pay-box"
      }
      role="region"
      aria-label={`${title} payment instructions`}
    >
      <div className="offline-pay-box-head">
        <Landmark size={18} aria-hidden="true" />
        <div>
          <strong>Pay by {title}</strong>
          {amountDue != null && amountDue > 0 ? (
            <p>
              Amount due: <strong>{usd.format(amountDue)}</strong>
            </p>
          ) : (
            <p>Use the details below to complete your payment.</p>
          )}
        </div>
      </div>

      <div className="offline-pay-memo" role="alert">
        <AlertTriangle size={16} aria-hidden="true" />
        <div>
          <strong>Important — memo / reference</strong>
          <p>
            {orderNumber ? (
              <>
                In the payment memo or description, type your{" "}
                <strong>order number exactly: {orderNumber}</strong>
                {invoiceNumber ? (
                  <>
                    {" "}
                    (or invoice <strong>{invoiceNumber}</strong>)
                  </>
                ) : null}
                . Without this, we may not match your payment to the order.
              </>
            ) : (
              <>
                After you place the order, you will get an <strong>order number</strong>. Put that{" "}
                <strong>order number in the Zelle / transfer memo</strong> (or check memo line) so
                we can match your payment. Do not leave the memo blank.
              </>
            )}
          </p>
        </div>
      </div>

      {method === "check" ? (
        <div className="offline-pay-fields">
          <div>
            <span className="offline-pay-label">Make check payable to</span>
            <strong>{store.checkPayableTo || store.payableTo || store.legalName}</strong>
          </div>
          {store.checkMailingNote ? (
            <div>
              <span className="offline-pay-label">Mailing / drop-off</span>
              <p>{store.checkMailingNote}</p>
            </div>
          ) : null}
          {store.addressLine1 || store.city ? (
            <div>
              <span className="offline-pay-label">Store address</span>
              <p>
                {[store.addressLine1, store.addressLine2, store.city, store.state, store.postalCode]
                  .filter(Boolean)
                  .join(", ")}
              </p>
            </div>
          ) : null}
        </div>
      ) : null}

      {method === "zelle" ? (
        <div className="offline-pay-fields">
          {store.zelleName ? (
            <div>
              <span className="offline-pay-label">Zelle name</span>
              <strong>{store.zelleName}</strong>
            </div>
          ) : null}
          {store.zelleEmailOrPhone ? (
            <div>
              <span className="offline-pay-label">Send Zelle to</span>
              <strong className="offline-pay-highlight">{store.zelleEmailOrPhone}</strong>
            </div>
          ) : (
            <p className="field-hint">
              Zelle details are not configured yet. Contact the store or check your invoice after
              placing the order.
            </p>
          )}
          {store.zelleInstructions ? (
            <div>
              <span className="offline-pay-label">Instructions</span>
              <p>{store.zelleInstructions}</p>
            </div>
          ) : null}
        </div>
      ) : null}

      {method === "bank_transfer" ? (
        <div className="offline-pay-fields">
          {store.bankName || store.bankRoutingNumber || store.bankAccountNumber ? (
            <>
              {store.bankName ? (
                <div>
                  <span className="offline-pay-label">Bank</span>
                  <strong>{store.bankName}</strong>
                </div>
              ) : null}
              {store.bankAccountName ? (
                <div>
                  <span className="offline-pay-label">Account name</span>
                  <strong>{store.bankAccountName}</strong>
                </div>
              ) : null}
              {store.bankRoutingNumber ? (
                <div>
                  <span className="offline-pay-label">Routing number</span>
                  <strong className="offline-pay-highlight">{store.bankRoutingNumber}</strong>
                </div>
              ) : null}
              {store.bankAccountNumber ? (
                <div>
                  <span className="offline-pay-label">Account number</span>
                  <strong className="offline-pay-highlight">
                    {store.bankAccountNumber}
                    {store.bankAccountType ? ` (${store.bankAccountType})` : ""}
                  </strong>
                </div>
              ) : null}
            </>
          ) : (
            <p className="field-hint">
              Bank transfer details are not configured yet. Contact the store or open your invoice
              after placing the order.
            </p>
          )}
          {store.bankInstructions ? (
            <div>
              <span className="offline-pay-label">Instructions</span>
              <p>{store.bankInstructions}</p>
            </div>
          ) : null}
        </div>
      ) : null}

      {store.email || store.phone ? (
        <p className="field-hint" style={{ marginTop: 10, marginBottom: 0 }}>
          Questions?{" "}
          {store.email ? (
            <a className="text-link" href={`mailto:${store.email}`}>
              {store.email}
            </a>
          ) : null}
          {store.email && store.phone ? " · " : null}
          {store.phone || null}
        </p>
      ) : null}
    </div>
  );
}
