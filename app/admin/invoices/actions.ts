"use server";

import { revalidatePath } from "next/cache";
import { getViewer } from "@/lib/auth";
import { findOrCreateThread } from "@/lib/data/inbox";
import { getStoreBusinessProfile } from "@/lib/data/store-settings";
import type { InboxActionState } from "@/lib/email/form-state";
import { sendEmail } from "@/lib/email/send";
import { buildOutboundBody } from "@/lib/email/signature";
import { usd } from "@/lib/format";
import { callerKey, checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";

function fail(message: string): InboxActionState {
  return { status: "error", message };
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const PAID_STATUSES = new Set(["paid"]);

/**
 * Địa chỉ nhận: ưu tiên email KHÁCH DÙNG ĐỂ ĐĂNG NHẬP (profiles.email nối qua
 * customers.auth_user_id), lùi về customers.email nếu khách chưa có tài khoản.
 */
async function resolveCustomerEmail(customerId: string) {
  const supabase = createAdminClient();
  const { data: customer } = await supabase
    .from("customers")
    .select("id, email, first_name, last_name, company_name, auth_user_id")
    .eq("id", customerId)
    .maybeSingle();
  if (!customer) return null;

  let email = (customer.email as string | null)?.trim() || null;
  if (customer.auth_user_id) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("email")
      .eq("id", customer.auth_user_id)
      .maybeSingle();
    const loginEmail = (profile?.email as string | null)?.trim();
    if (loginEmail) email = loginEmail;
  }
  if (!email) return null;

  const name =
    (customer.company_name as string | null) ||
    [customer.first_name, customer.last_name].filter(Boolean).join(" ") ||
    null;

  return { email, name };
}

function row(label: string, value: string) {
  return `<tr><td style="padding:6px 12px 6px 0;color:#6b7280">${escapeHtml(
    label
  )}</td><td style="padding:6px 0;font-weight:700">${escapeHtml(value)}</td></tr>`;
}

/**
 * Gửi invoice cho khách.
 *  - Đã thanh toán -> thư biên nhận, nội dung là thông tin invoice.
 *  - Chưa thanh toán -> thư nhắc, kèm số dư và hướng dẫn thanh toán offline.
 * Người gửi vẫn do server suy ra từ phiên đăng nhập (xem buildOutboundBody).
 */
export async function sendInvoiceEmail(
  _prev: InboxActionState,
  formData: FormData
): Promise<InboxActionState> {
  const viewer = await getViewer();
  if (!viewer?.canAccessAdmin) return fail("Bạn không có quyền gửi thư.");
  if (viewer.demo) return fail("Chế độ demo không gửi được thư.");

  if (!(await checkRateLimit(await callerKey("invoice-send", viewer.id), RATE_LIMITS.mutation))) {
    return fail("Gửi quá nhanh. Đợi một chút rồi thử lại.");
  }

  const invoiceId = String(formData.get("invoiceId") ?? "").trim().slice(0, 40);
  if (!invoiceId) return fail("Thiếu invoice.");

  const supabase = createAdminClient();
  const { data: invoice } = await supabase
    .from("invoices")
    .select(
      "id, invoice_number, customer_id, status, issue_date, due_date, total_amount, amount_paid, balance_due"
    )
    .eq("id", invoiceId)
    .maybeSingle();
  if (!invoice) return fail("Không tìm thấy invoice.");
  if (!invoice.customer_id) return fail("Invoice chưa gắn khách hàng.");

  const contact = await resolveCustomerEmail(invoice.customer_id as string);
  if (!contact) {
    return fail("Khách hàng này chưa có email đăng nhập — không biết gửi tới đâu.");
  }

  const number = (invoice.invoice_number as string | null) || invoice.id;
  const total = Number(invoice.total_amount ?? 0);
  const paid = Number(invoice.amount_paid ?? 0);
  const balance = Number(invoice.balance_due ?? 0);
  const isPaid = PAID_STATUSES.has(String(invoice.status)) || balance <= 0;

  const store = await getStoreBusinessProfile();
  const storeName = store.displayName || store.legalName || "Vinameals";

  let subject: string;
  let text: string;
  let htmlBody: string;

  const facts = [
    row("Invoice", number),
    row("Ngày phát hành", String(invoice.issue_date ?? "—")),
    row("Tổng cộng", usd.format(total))
  ];

  if (isPaid) {
    subject = `Biên nhận thanh toán — invoice ${number}`;
    facts.push(row("Đã thanh toán", usd.format(paid)));
    text = [
      `Cảm ơn bạn đã thanh toán.`,
      `Invoice: ${number}`,
      `Ngày phát hành: ${invoice.issue_date ?? "—"}`,
      `Tổng cộng: ${usd.format(total)}`,
      `Đã thanh toán: ${usd.format(paid)}`,
      `Invoice này đã được thanh toán đầy đủ. Thư này là biên nhận của bạn.`
    ].join("\n");
    htmlBody =
      `<p style="margin:0 0 12px">Cảm ơn bạn đã thanh toán. Invoice dưới đây đã được thanh toán đầy đủ — thư này là biên nhận của bạn.</p>` +
      `<table style="border-collapse:collapse;margin:0 0 12px">${facts.join("")}</table>`;
  } else {
    subject = `Nhắc thanh toán — invoice ${number}`;
    facts.push(row("Đã thanh toán", usd.format(paid)));
    facts.push(row("Còn phải trả", usd.format(balance)));
    if (invoice.due_date) facts.push(row("Hạn thanh toán", String(invoice.due_date)));

    const payLines: string[] = [];
    if (store.checkPayableTo) {
      payLines.push(`Séc ghi tên: ${store.checkPayableTo}`);
      if (store.checkMailingNote) payLines.push(store.checkMailingNote);
    }
    if (store.zelleEmailOrPhone) {
      payLines.push(`Zelle: ${store.zelleEmailOrPhone}${store.zelleName ? ` (${store.zelleName})` : ""}`);
    }
    if (store.bankName) {
      payLines.push(`Chuyển khoản: ${store.bankName}${store.bankAccountName ? ` — ${store.bankAccountName}` : ""}`);
      if (store.bankInstructions) payLines.push(store.bankInstructions);
    }

    text = [
      `Xin nhắc bạn về invoice chưa thanh toán.`,
      `Invoice: ${number}`,
      `Tổng cộng: ${usd.format(total)}`,
      `Còn phải trả: ${usd.format(balance)}`,
      invoice.due_date ? `Hạn thanh toán: ${invoice.due_date}` : "",
      payLines.length ? `\nCách thanh toán:\n${payLines.join("\n")}` : "",
      `\nNếu bạn đã thanh toán rồi, xin bỏ qua thư này.`
    ]
      .filter(Boolean)
      .join("\n");

    htmlBody =
      `<p style="margin:0 0 12px">Xin nhắc bạn về invoice chưa thanh toán bên dưới.</p>` +
      `<table style="border-collapse:collapse;margin:0 0 12px">${facts.join("")}</table>` +
      (payLines.length
        ? `<p style="margin:0 0 6px;font-weight:700">Cách thanh toán</p>` +
          `<p style="margin:0 0 12px;color:#444">${payLines.map(escapeHtml).join("<br>")}</p>`
        : "") +
      `<p style="margin:0;color:#6b7280;font-size:13px">Nếu bạn đã thanh toán rồi, xin bỏ qua thư này.</p>`;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("email_signature")
    .eq("id", viewer.id)
    .maybeSingle();

  const composed = buildOutboundBody({
    body: text,
    viewer,
    signature: (profile?.email_signature as string | null) ?? null,
    htmlBody
  });

  const sent = await sendEmail({
    to: [contact.email],
    subject,
    text: composed.text,
    html: composed.html
  });
  if (!sent.ok) return fail(`Không gửi được: ${sent.error}`);

  // Ghi vào hộp thư để cả nhóm thấy invoice này đã được gửi, và ai gửi.
  const threadId = await findOrCreateThread({
    contactAddress: contact.email,
    contactName: contact.name,
    subject,
    customerId: invoice.customer_id as string
  });
  if (threadId) {
    await supabase.from("email_messages").insert({
      thread_id: threadId,
      direction: "outbound",
      from_address: "support@vinamealsupplies.com",
      from_name: storeName,
      to_addresses: [contact.email],
      subject,
      text_body: composed.text,
      html_body: composed.html,
      sent_by: viewer.id,
      sent_by_name: composed.sentByName,
      provider_id: sent.id
    });
  }

  revalidatePath("/admin/invoices");
  revalidatePath("/admin/inbox");
  return {
    status: "success",
    message: `${isPaid ? "Đã gửi biên nhận" : "Đã gửi nhắc thanh toán"} tới ${contact.email} — ký tên ${composed.sentByName}.`
  };
}
