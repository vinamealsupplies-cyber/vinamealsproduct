import "server-only";

import type { CustomerInvoiceView } from "@/lib/data/customer-invoice";
import type { StoreBusinessProfile } from "@/lib/store-profile";

// Gọi worker render PDF riêng (pdf-lib không nhét vừa worker chính gói Free).
// Cần env: INVOICE_PDF_URL (công khai) + INVOICE_PDF_SECRET (bí mật chia sẻ).
// Thiếu cấu hình hoặc lỗi → trả null; caller vẫn gửi email (không kèm file).
export async function renderInvoicePdfRemote(
  view: CustomerInvoiceView,
  store: StoreBusinessProfile
): Promise<Uint8Array | null> {
  const url = process.env.INVOICE_PDF_URL?.trim();
  const secret = process.env.INVOICE_PDF_SECRET?.trim();
  if (!url || !secret) return null;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${secret}`
      },
      body: JSON.stringify({ view, store })
    });
    if (!res.ok) {
      console.error("[invoice pdf] worker", res.status);
      return null;
    }
    return new Uint8Array(await res.arrayBuffer());
  } catch (err) {
    console.error("[invoice pdf] worker fetch", err);
    return null;
  }
}
