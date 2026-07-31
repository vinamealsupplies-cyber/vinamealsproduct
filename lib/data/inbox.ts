import "server-only";

import { buildPreview } from "@/lib/email/sanitize";
import type { InboxAttachment, InboxMessage, InboxThread } from "@/lib/email/types";
import { createAdminClient } from "@/lib/supabase/admin";

// Hộp thư hỗ trợ. Đọc/ghi bằng service role như phần còn lại của khu admin;
// cổng phân quyền là viewer.canAccessAdmin ở tầng trang/action.

type DbThread = {
  id: string;
  subject: string;
  contact_address: string;
  contact_name: string | null;
  customer_id: string | null;
  status: "open" | "closed";
  message_count: number;
  has_unread: boolean;
  last_message_at: string;
  created_at: string;
};

type DbAttachment = {
  id: string;
  filename: string;
  content_type: string;
  bytes: number;
  object_key: string;
};

type DbMessage = {
  id: string;
  thread_id: string;
  direction: "inbound" | "outbound";
  from_address: string;
  from_name: string | null;
  to_addresses: string[] | null;
  cc_addresses: string[] | null;
  subject: string;
  text_body: string | null;
  html_body: string | null;
  rfc_message_id: string | null;
  in_reply_to: string | null;
  sent_by: string | null;
  sent_by_name: string | null;
  provider_id: string | null;
  created_at: string;
  email_attachments?: DbAttachment[] | null;
};

const THREAD_SELECT =
  "id, subject, contact_address, contact_name, customer_id, status, message_count, has_unread, last_message_at, created_at";

const MESSAGE_SELECT = `id, thread_id, direction, from_address, from_name, to_addresses, cc_addresses,
   subject, text_body, html_body, rfc_message_id, in_reply_to, sent_by, sent_by_name,
   provider_id, created_at,
   email_attachments ( id, filename, content_type, bytes, object_key )`;

function mapThread(row: DbThread): InboxThread {
  return {
    id: row.id,
    subject: row.subject,
    contactAddress: row.contact_address,
    contactName: row.contact_name,
    customerId: row.customer_id,
    status: row.status,
    messageCount: row.message_count,
    hasUnread: row.has_unread,
    lastMessageAt: row.last_message_at,
    createdAt: row.created_at
  };
}

function mapAttachment(row: DbAttachment): InboxAttachment {
  return {
    id: row.id,
    filename: row.filename,
    contentType: row.content_type,
    bytes: row.bytes,
    objectKey: row.object_key
  };
}

function mapMessage(row: DbMessage): InboxMessage {
  return {
    id: row.id,
    threadId: row.thread_id,
    direction: row.direction,
    fromAddress: row.from_address,
    fromName: row.from_name,
    toAddresses: row.to_addresses ?? [],
    ccAddresses: row.cc_addresses ?? [],
    subject: row.subject,
    textBody: row.text_body,
    htmlBody: row.html_body,
    rfcMessageId: row.rfc_message_id,
    inReplyTo: row.in_reply_to,
    sentBy: row.sent_by,
    sentByName: row.sent_by_name,
    providerId: row.provider_id,
    createdAt: row.created_at,
    attachments: (row.email_attachments ?? []).map(mapAttachment)
  };
}

/** Danh sách hội thoại, mới nhất trước, kèm đoạn xem trước của thư cuối. */
export async function getInboxThreads(options?: { status?: "open" | "closed" | "all" }) {
  const supabase = createAdminClient();
  let query = supabase
    .from("email_threads")
    .select(THREAD_SELECT)
    .order("last_message_at", { ascending: false })
    .limit(100);

  const status = options?.status ?? "open";
  if (status !== "all") query = query.eq("status", status);

  const { data, error } = await query;
  if (error || !data) return [];

  const threads = (data as DbThread[]).map(mapThread);
  if (threads.length === 0) return threads;

  // Một truy vấn cho tất cả preview thay vì N+1.
  const { data: latest } = await supabase
    .from("email_messages")
    .select("thread_id, text_body, html_body, created_at")
    .in(
      "thread_id",
      threads.map((t) => t.id)
    )
    .order("created_at", { ascending: false });

  const seen = new Set<string>();
  const previews = new Map<string, string>();
  for (const row of (latest ?? []) as Array<{
    thread_id: string;
    text_body: string | null;
    html_body: string | null;
  }>) {
    if (seen.has(row.thread_id)) continue;
    seen.add(row.thread_id);
    previews.set(row.thread_id, buildPreview(row.text_body, row.html_body));
  }

  return threads.map((thread) => ({ ...thread, preview: previews.get(thread.id) ?? "" }));
}

export async function getInboxThread(threadId: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("email_threads")
    .select(THREAD_SELECT)
    .eq("id", threadId)
    .maybeSingle();
  if (error || !data) return null;
  return mapThread(data as DbThread);
}

export async function getThreadMessages(threadId: string): Promise<InboxMessage[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("email_messages")
    .select(MESSAGE_SELECT)
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true });
  if (error || !data) return [];
  return (data as unknown as DbMessage[]).map(mapMessage);
}

export async function countUnreadThreads() {
  const supabase = createAdminClient();
  const { count } = await supabase
    .from("email_threads")
    .select("id", { count: "exact", head: true })
    .eq("has_unread", true)
    .eq("status", "open");
  return count ?? 0;
}

/** Mở thread ra thì bỏ dấu chưa đọc. */
export async function markThreadRead(threadId: string) {
  const supabase = createAdminClient();
  await supabase.from("email_threads").update({ has_unread: false }).eq("id", threadId);
}

/**
 * Tìm (hoặc tạo) hội thoại theo địa chỉ khách — dùng khi admin chủ động gửi
 * thư đi (vd. gửi invoice) mà chưa có luồng nào.
 */
export async function findOrCreateThread(input: {
  contactAddress: string;
  contactName?: string | null;
  subject: string;
  customerId?: string | null;
}) {
  const supabase = createAdminClient();
  const address = input.contactAddress.trim().toLowerCase();

  const { data: existing } = await supabase
    .from("email_threads")
    .select("id")
    .ilike("contact_address", address)
    .eq("status", "open")
    .order("last_message_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) return existing.id as string;

  const { data: created, error } = await supabase
    .from("email_threads")
    .insert({
      contact_address: address,
      contact_name: input.contactName ?? null,
      subject: input.subject,
      customer_id: input.customerId ?? null
    })
    .select("id")
    .single();

  if (error || !created) return null;
  return created.id as string;
}
