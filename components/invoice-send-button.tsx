"use client";

import { useActionState } from "react";
import { BellRing, ReceiptText } from "lucide-react";
import { sendInvoiceEmail } from "@/app/admin/invoices/actions";
import { initialInboxActionState } from "@/lib/email/form-state";

/**
 * Nút gửi invoice cho khách. Nội dung thư do server chọn theo trạng thái
 * thanh toán — client không quyết định gửi loại nào, chỉ truyền invoiceId.
 */
export function InvoiceSendButton({ invoiceId, isPaid }: { invoiceId: string; isPaid: boolean }) {
  const [state, action, pending] = useActionState(sendInvoiceEmail, initialInboxActionState);

  return (
    <form action={action} className="invoice-send">
      <input type="hidden" name="invoiceId" value={invoiceId} />
      <button
        className="button ghost compact"
        type="submit"
        disabled={pending}
        title={isPaid ? "Gửi biên nhận cho khách" : "Nhắc khách thanh toán"}
      >
        {isPaid ? (
          <ReceiptText size={14} aria-hidden="true" />
        ) : (
          <BellRing size={14} aria-hidden="true" />
        )}
        {pending ? "Đang gửi…" : isPaid ? "Gửi biên nhận" : "Nhắc trả tiền"}
      </button>
      {state.status !== "idle" ? (
        <small
          className={state.status === "error" ? "invoice-send-msg error" : "invoice-send-msg ok"}
          role={state.status === "error" ? "alert" : "status"}
        >
          {state.message}
        </small>
      ) : null}
    </form>
  );
}
