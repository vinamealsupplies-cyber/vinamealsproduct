"use server";

import { revalidatePath } from "next/cache";
import { getViewer } from "@/lib/auth";
import { findOrCreateThread, getThreadMessages, markThreadRead } from "@/lib/data/inbox";
import type { InboxActionState } from "@/lib/email/form-state";
import type { ContactHit } from "@/lib/email/inbox-types";
import { buildOutboundBody } from "@/lib/email/signature";
import { sendEmail } from "@/lib/email/send";
import {
  addSubjectTemplate,
  listSubjectTemplates
} from "@/lib/email/subject-templates";
import { callerKey, checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";

function fail(message: string): InboxActionState {
  return { status: "error", message };
}

function readField(formData: FormData, name: string, max = 5000) {
  return String(formData.get(name) ?? "").trim().slice(0, max);
}

/** Chữ ký cá nhân đã lưu của nhân viên (có thể chưa đặt). */
async function loadSignature(viewerId: string) {
  const { data } = await createAdminClient()
    .from("profiles")
    .select("email_signature")
    .eq("id", viewerId)
    .maybeSingle();
  return (data?.email_signature as string | null) ?? null;
}

/**
 * Gửi thư — dùng cho cả trả lời trong hộp thư lẫn gửi chủ động.
 *
 * TÊN NGƯỜI GỬI KHÔNG ĐẾN TỪ FORM. Nó được suy ra từ getViewer() rồi ghi vào
 * email_messages.sent_by_name; DB còn có CHECK constraint bắt buộc cột này phải
 * có giá trị với mọi thư outbound. Nghĩa là không có đường nào để một nhân viên
 * gửi thư mà không bị ghi tên, hoặc gửi dưới tên người khác.
 */
export async function sendThreadReply(
  _prev: InboxActionState,
  formData: FormData
): Promise<InboxActionState> {
  const viewer = await getViewer();
  if (!viewer?.canAccessAdmin) return fail("Bạn không có quyền gửi thư.");
  if (viewer.demo) return fail("Chế độ demo không gửi được thư.");

  if (!(await checkRateLimit(await callerKey("inbox-send", viewer.id), RATE_LIMITS.mutation))) {
    return fail("Gửi quá nhanh. Đợi một chút rồi thử lại.");
  }

  const threadId = readField(formData, "threadId", 40);
  const body = readField(formData, "body", 20000);
  if (!threadId) return fail("Thiếu hội thoại.");
  if (!body) return fail("Nội dung thư đang trống.");

  const supabase = createAdminClient();
  const { data: thread } = await supabase
    .from("email_threads")
    .select("id, subject, contact_address")
    .eq("id", threadId)
    .maybeSingle();
  if (!thread) return fail("Không tìm thấy hội thoại.");

  // Nối vào đúng luồng: In-Reply-To trỏ tới thư gần nhất của khách.
  const messages = await getThreadMessages(threadId);
  const lastInbound = [...messages].reverse().find((m) => m.direction === "inbound");
  const references = messages
    .map((m) => m.rfcMessageId)
    .filter((id): id is string => Boolean(id));

  const signature = await loadSignature(viewer.id);
  const composed = buildOutboundBody({ body, viewer, signature });

  const subject = thread.subject.toLowerCase().startsWith("re:")
    ? thread.subject
    : `Re: ${thread.subject}`;

  const sent = await sendEmail({
    to: [thread.contact_address],
    subject,
    text: composed.text,
    html: composed.html,
    inReplyTo: lastInbound?.rfcMessageId ?? null,
    references
  });
  if (!sent.ok) return fail(`Không gửi được: ${sent.error}`);

  const { error } = await supabase.from("email_messages").insert({
    thread_id: threadId,
    direction: "outbound",
    from_address: "support@vinamealsupplies.com",
    from_name: "Vinameals",
    to_addresses: [thread.contact_address],
    subject,
    text_body: composed.text,
    html_body: composed.html,
    in_reply_to: lastInbound?.rfcMessageId ?? null,
    sent_by: viewer.id,
    sent_by_name: composed.sentByName,
    provider_id: sent.id
  });
  if (error) return fail(`Đã gửi nhưng không lưu được vào lịch sử: ${error.message}`);

  revalidatePath("/admin/inbox");
  revalidatePath(`/admin/inbox/${threadId}`);
  return { status: "success", message: `Đã gửi — ký tên ${composed.sentByName}.` };
}

/** Đóng / mở lại hội thoại. */
export async function setThreadStatus(formData: FormData): Promise<void> {
  const viewer = await getViewer();
  if (!viewer?.canAccessAdmin || viewer.demo) return;

  const threadId = readField(formData, "threadId", 40);
  const status = readField(formData, "status", 10);
  if (!threadId || (status !== "open" && status !== "closed")) return;

  await createAdminClient().from("email_threads").update({ status }).eq("id", threadId);
  revalidatePath("/admin/inbox");
  revalidatePath(`/admin/inbox/${threadId}`);
}

/** Mở hội thoại thì bỏ dấu chưa đọc. */
export async function markRead(threadId: string) {
  const viewer = await getViewer();
  if (!viewer?.canAccessAdmin || viewer.demo) return;
  await markThreadRead(threadId);
}

/** Gửi thư mới cho một địa chỉ chưa có hội thoại nào. */
export async function startThread(
  _prev: InboxActionState,
  formData: FormData
): Promise<InboxActionState> {
  const viewer = await getViewer();
  if (!viewer?.canAccessAdmin) return fail("Bạn không có quyền gửi thư.");
  if (viewer.demo) return fail("Chế độ demo không gửi được thư.");

  if (!(await checkRateLimit(await callerKey("inbox-new", viewer.id), RATE_LIMITS.mutation))) {
    return fail("Gửi quá nhanh. Đợi một chút rồi thử lại.");
  }

  const to = readField(formData, "to", 160).toLowerCase();
  const subject = readField(formData, "subject", 200) || "(no subject)";
  const body = readField(formData, "body", 20000);

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return fail("Địa chỉ email không hợp lệ.");
  if (!body) return fail("Nội dung thư đang trống.");

  const threadId = await findOrCreateThread({ contactAddress: to, subject });
  if (!threadId) return fail("Không tạo được hội thoại.");

  const signature = await loadSignature(viewer.id);
  const composed = buildOutboundBody({ body, viewer, signature });

  const sent = await sendEmail({ to: [to], subject, text: composed.text, html: composed.html });
  if (!sent.ok) return fail(`Không gửi được: ${sent.error}`);

  await createAdminClient().from("email_messages").insert({
    thread_id: threadId,
    direction: "outbound",
    from_address: "support@vinamealsupplies.com",
    from_name: "Vinameals",
    to_addresses: [to],
    subject,
    text_body: composed.text,
    html_body: composed.html,
    sent_by: viewer.id,
    sent_by_name: composed.sentByName,
    provider_id: sent.id
  });

  revalidatePath("/admin/inbox");
  return { status: "success", message: `Đã gửi tới ${to} — ký tên ${composed.sentByName}.` };
}

/**
 * Tìm contact để điền ô "Gửi tới" — nguồn là email tài khoản (`profiles`, tức
 * email khách dùng lúc tạo account). Khách (role customer) xếp trước.
 */
export async function searchContacts(query: string): Promise<ContactHit[]> {
  const viewer = await getViewer();
  if (!viewer?.canAccessAdmin || viewer.demo) return [];

  // Ký tự có nghĩa trong filter PostgREST (`,` `(` `)` …) phải bỏ, nếu không câu
  // `.or()` sẽ vỡ cú pháp (hoặc bị lợi dụng chèn điều kiện).
  const safe = query.replace(/[%,()*\\"'\s]+/g, " ").trim().slice(0, 60);
  if (safe.length < 2) return [];

  const { data } = await createAdminClient()
    .from("profiles")
    .select("email, full_name, role")
    .eq("status", "active")
    .or(`email.ilike.%${safe}%,full_name.ilike.%${safe}%`)
    .limit(8);

  const rows = (data ?? []) as { email: string | null; full_name: string | null; role: string | null }[];
  return rows
    .filter((r) => r.email)
    .map((r) => ({ email: r.email as string, name: r.full_name?.trim() ?? "", role: r.role ?? "" }))
    .sort(
      (a, b) =>
        (a.role === "customer" ? 0 : 1) - (b.role === "customer" ? 0 : 1) ||
        a.name.localeCompare(b.name)
    );
}

/** Danh sách tiêu đề mẫu (mặc định + tự thêm) cho dropdown khi soạn thư. */
export async function loadSubjectTemplates(): Promise<string[]> {
  const viewer = await getViewer();
  if (!viewer?.canAccessAdmin) return [];
  return listSubjectTemplates();
}

/** Lưu một tiêu đề tự tạo vào danh sách mẫu dùng chung. */
export async function createSubjectTemplate(
  subject: string
): Promise<{ ok: true; templates: string[] } | { ok: false; error: string }> {
  const viewer = await getViewer();
  if (!viewer?.canAccessAdmin) return { ok: false, error: "Bạn không có quyền." };
  if (viewer.demo) return { ok: false, error: "Chế độ demo không lưu được." };
  if (!(await checkRateLimit(await callerKey("inbox-subj", viewer.id), RATE_LIMITS.mutation))) {
    return { ok: false, error: "Thao tác quá nhanh. Đợi một chút." };
  }
  return addSubjectTemplate(subject, viewer.id);
}

/** Lưu chữ ký cá nhân của chính người đang đăng nhập. */
export async function saveMySignature(
  _prev: InboxActionState,
  formData: FormData
): Promise<InboxActionState> {
  const viewer = await getViewer();
  if (!viewer?.canAccessAdmin) return fail("Bạn không có quyền.");
  if (viewer.demo) return fail("Chế độ demo không lưu được.");

  if (!(await checkRateLimit(await callerKey("inbox-sig", viewer.id), RATE_LIMITS.mutation))) {
    return fail("Lưu quá nhanh. Đợi một chút rồi thử lại.");
  }

  // Chỉ lưu cho CHÍNH mình — không nhận id người khác từ form.
  const signature = readField(formData, "signature", 600);
  const { error } = await createAdminClient()
    .from("profiles")
    .update({ email_signature: signature || null })
    .eq("id", viewer.id);

  if (error) return fail(error.message);

  revalidatePath("/admin/inbox/signature");
  return {
    status: "success",
    message: signature ? "Đã lưu chữ ký." : "Đã xoá chữ ký."
  };
}
