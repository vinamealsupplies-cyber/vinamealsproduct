import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Paperclip, UserRound } from "lucide-react";
import { AdminPageHeader } from "@/components/admin-page-header";
import { EmailBodyFrame } from "@/components/email-body-frame";
import { InboxReplyForm } from "@/components/inbox-reply-form";
import { setThreadStatus } from "@/app/admin/inbox/actions";
import { requireAdminAccessPage } from "@/lib/auth";
import { getInboxThread, getThreadMessages, markThreadRead } from "@/lib/data/inbox";
import { sanitizeEmailHtml, textToSafeHtml } from "@/lib/email/sanitize";
import { senderDisplayName } from "@/lib/email/signature";
import { formatDate } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata = { title: "Hội thoại" };

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default async function InboxThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await requireAdminAccessPage();
  const { id } = await params;

  const thread = await getInboxThread(id);
  if (!thread) notFound();

  const messages = await getThreadMessages(id);
  // Mở ra là coi như đã đọc.
  if (thread.hasUnread) await markThreadRead(id);

  const { data: profile } = await createAdminClient()
    .from("profiles")
    .select("email_signature")
    .eq("id", viewer.id)
    .maybeSingle();

  return (
    <>
      <AdminPageHeader
        eyebrow={thread.contactAddress}
        title={thread.subject}
        description={`${thread.messageCount} thư · bắt đầu ${formatDate(thread.createdAt)}`}
        action={
          <Link className="button ghost" href="/admin/inbox">
            <ArrowLeft size={15} aria-hidden="true" /> Về hộp thư
          </Link>
        }
      />

      <form action={setThreadStatus} className="row-actions">
        <input type="hidden" name="threadId" value={thread.id} />
        <input type="hidden" name="status" value={thread.status === "open" ? "closed" : "open"} />
        <button className="button ghost compact" type="submit">
          {thread.status === "open" ? "Đánh dấu đã xử lý" : "Mở lại hội thoại"}
        </button>
        {thread.customerId ? (
          <Link className="text-link" href={`/admin/customers?focus=${thread.customerId}`}>
            <UserRound size={14} aria-hidden="true" /> Xem khách hàng
          </Link>
        ) : null}
      </form>

      <ol className="email-thread">
        {messages.map((message) => {
          const outbound = message.direction === "outbound";
          // Thư đến: sanitize rồi vẫn nhốt trong iframe sandbox (2 lớp).
          const body = message.htmlBody
            ? sanitizeEmailHtml(message.htmlBody)
            : textToSafeHtml(message.textBody);

          return (
            <li key={message.id} className={outbound ? "email-item outbound" : "email-item inbound"}>
              <header className="email-item-head">
                <strong>
                  {outbound
                    ? `Vinameals · ${message.sentByName ?? "?"}`
                    : message.fromName || message.fromAddress}
                </strong>
                <small>{formatDate(message.createdAt)}</small>
              </header>
              <p className="email-item-meta">
                {outbound ? `Tới ${message.toAddresses.join(", ")}` : `Từ ${message.fromAddress}`}
              </p>

              <EmailBodyFrame html={body} title={`Nội dung thư ${message.id}`} />

              {message.attachments.length > 0 ? (
                <ul className="email-attachments">
                  {message.attachments.map((file) => (
                    <li key={file.id}>
                      <a href={`/api/admin/inbox/attachment/${file.id}`}>
                        <Paperclip size={13} aria-hidden="true" /> {file.filename}
                      </a>
                      <small>{formatBytes(file.bytes)}</small>
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          );
        })}
      </ol>

      <InboxReplyForm
        threadId={thread.id}
        senderName={senderDisplayName(viewer)}
        hasSignature={Boolean(profile?.email_signature?.trim())}
      />
    </>
  );
}
